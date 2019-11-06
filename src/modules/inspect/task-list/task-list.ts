import {Subscription} from 'aurelia-event-aggregator';
import {bindable, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import * as Bluebird from 'bluebird';

import {ForbiddenError, UnauthorizedError, isError} from '@essential-projects/errors_ts';
import {Subscription as RuntimeSubscription} from '@essential-projects/event_aggregator_contracts';

import {IIdentity} from '@essential-projects/iam_contracts';
import {AuthenticationStateEvent, ISolutionEntry, ISolutionService} from '../../../contracts/index';
import environment from '../../../environment';
import {IDashboardService, TaskList as SuspendedTaskList, TaskListEntry} from '../dashboard/contracts/index';
import {Pagination} from '../../pagination/pagination';

interface ITaskListRouteParameters {
  processInstanceId?: string;
  diagramName?: string;
  correlationId?: string;
}

@inject('DashboardService', Router, 'SolutionService')
export class TaskList {
  @bindable() public activeSolutionEntry: ISolutionEntry;

  @observable public currentPage: number = 1;
  public pageSize: number = 10;
  public totalItems: number;
  public paginationSize: number = 10;

  public initialLoadingFinished: boolean = false;
  public showError: boolean = false;

  public pagination: Pagination;
  public paginationShowsLoading: boolean;

  private activeSolutionUri: string;
  private dashboardService: IDashboardService;
  private router: Router;
  private solutionService: ISolutionService;

  private dashboardServiceSubscriptions: Array<RuntimeSubscription> = [];
  private subscriptions: Array<Subscription>;
  private tasks: Array<TaskListEntry> = [];
  private getTasks: (offset?: number, limit?: number) => Promise<SuspendedTaskList>;

  private isAttached: boolean;

  private updatePromise: any;
  private identitiyUsedForSubscriptions: IIdentity;

  constructor(dashboardService: IDashboardService, router: Router, solutionService: ISolutionService) {
    this.dashboardService = dashboardService;
    this.router = router;
    this.solutionService = solutionService;
  }

  public async attached(): Promise<void> {
    const getTasksIsUndefined: boolean = this.getTasks === undefined;

    this.activeSolutionUri = this.router.currentInstruction.queryParams.solutionUri;

    const activeSolutionUriIsNotSet: boolean = this.activeSolutionUri === undefined;

    if (activeSolutionUriIsNotSet) {
      this.activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    const activeSolutionUriIsNotRemote: boolean = !this.activeSolutionUri.startsWith('http');
    if (activeSolutionUriIsNotRemote) {
      this.activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(this.activeSolutionUri);

    if (getTasksIsUndefined) {
      this.getTasks = this.getAllTasks;
    }

    await this.updateTasks();

    this.subscriptions = [
      this.dashboardService.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, async () => {
        this.removeRuntimeSubscriptions();

        await this.updateTasks();

        this.setRuntimeSubscriptions();
      }),
    ];

    this.isAttached = true;

    this.setRuntimeSubscriptions();
  }

  public detached(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }

    this.isAttached = false;

    this.removeRuntimeSubscriptions();
  }

  public goBack(): void {
    this.router.navigateBack();
  }

  public continueTask(task: TaskListEntry): void {
    const {correlationId, id, processInstanceId} = task;

    this.router.navigateToRoute('live-execution-tracker', {
      diagramName: task.processModelId,
      solutionUri: this.activeSolutionEntry.uri,
      correlationId: correlationId,
      processInstanceId: processInstanceId,
      taskId: id,
    });
  }

  public async activeSolutionEntryChanged(
    newActiveSolutionEntry: ISolutionEntry,
    previousActiveSolutionEntry: ISolutionEntry,
  ): Promise<void> {
    if (!newActiveSolutionEntry.uri.includes('http')) {
      return;
    }

    if (!this.isAttached) {
      return;
    }

    if (this.updatePromise) {
      this.updatePromise.cancel();
    }

    const previousActiveSolutionEntryExists: boolean = previousActiveSolutionEntry !== undefined;
    if (previousActiveSolutionEntryExists) {
      this.removeRuntimeSubscriptions();
    }

    this.tasks = [];
    this.initialLoadingFinished = false;
    this.showError = false;

    this.dashboardService.eventAggregator.publish(
      environment.events.configPanel.solutionEntryChanged,
      newActiveSolutionEntry,
    );

    await this.updateTasks();

    this.setRuntimeSubscriptions();
  }

  public currentPageChanged(currentPage: number, previousPage: number): void {
    const isInitialEvent: boolean = previousPage === undefined || previousPage === null;
    if (isInitialEvent) {
      return;
    }

    if (this.updatePromise) {
      this.updatePromise.cancel();
    }

    this.updateTasks();
  }

  public get shownTasks(): Array<TaskListEntry> {
    return this.tasks;
  }

  public initializeTaskList(routeParameters: ITaskListRouteParameters): void {
    const diagramName: string = routeParameters.diagramName;
    const correlationId: string = routeParameters.correlationId;
    const processInstanceId: string = routeParameters.processInstanceId;

    const hasDiagramName: boolean = diagramName !== undefined;
    const hasCorrelationId: boolean = correlationId !== undefined;
    const hasProcessInstanceId: boolean = processInstanceId !== undefined;

    if (hasDiagramName) {
      this.getTasks = (offset?: number, limit?: number): Promise<SuspendedTaskList> => {
        return this.getTasksForProcessModel(diagramName, offset, limit);
      };
    } else if (hasCorrelationId) {
      this.getTasks = (offset?: number, limit?: number): Promise<SuspendedTaskList> => {
        return this.getTasksForCorrelation(correlationId, offset, limit);
      };
    } else if (hasProcessInstanceId) {
      this.getTasks = (offset?: number, limit?: number): Promise<SuspendedTaskList> => {
        return this.getTasksForProcessInstanceId(processInstanceId, offset, limit);
      };
    } else {
      this.getTasks = this.getAllTasks;
    }
  }

  private async setRuntimeSubscriptions(): Promise<void> {
    const subscriptionsExist: boolean = this.dashboardServiceSubscriptions.length > 0;
    if (subscriptionsExist) {
      this.removeRuntimeSubscriptions();
    }

    this.identitiyUsedForSubscriptions = this.activeSolutionEntry.identity;

    this.dashboardServiceSubscriptions = await Promise.all([
      this.dashboardService.onProcessTerminated(this.activeSolutionEntry.identity, async () => {
        await this.updateTasks();
      }),
      this.dashboardService.onEmptyActivityFinished(this.activeSolutionEntry.identity, async () => {
        await this.updateTasks();
      }),
      this.dashboardService.onEmptyActivityWaiting(this.activeSolutionEntry.identity, async () => {
        await this.updateTasks();
      }),
      this.dashboardService.onUserTaskFinished(this.activeSolutionEntry.identity, async () => {
        await this.updateTasks();
      }),
      this.dashboardService.onUserTaskWaiting(this.activeSolutionEntry.identity, async () => {
        await this.updateTasks();
      }),
      this.dashboardService.onManualTaskFinished(this.activeSolutionEntry.identity, async () => {
        await this.updateTasks();
      }),
      this.dashboardService.onManualTaskWaiting(this.activeSolutionEntry.identity, async () => {
        await this.updateTasks();
      }),
      this.dashboardService.onProcessError(this.activeSolutionEntry.identity, async () => {
        await this.updateTasks();
      }),
    ]);
  }

  private removeRuntimeSubscriptions(): void {
    for (const subscription of this.dashboardServiceSubscriptions) {
      this.dashboardService.removeSubscription(this.identitiyUsedForSubscriptions, subscription);
    }

    this.dashboardServiceSubscriptions = [];
  }

  private getAllTasks(offset?: number, limit?: number): Promise<SuspendedTaskList> {
    return new Bluebird.Promise(
      async (resolve: Function, reject: Function, onCancel): Promise<void> => {
        try {
          const taskList: SuspendedTaskList = await this.dashboardService.getAllSuspendedTasks(
            this.activeSolutionEntry.identity,
            offset,
            limit,
          );

          resolve(taskList);
        } catch (error) {
          reject(error);
        }
      },
    );
  }

  private async getTasksForProcessModel(
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<SuspendedTaskList> {
    return new Bluebird.Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        try {
          const taskList: SuspendedTaskList = await this.dashboardService.getSuspendedTasksForProcessModel(
            this.activeSolutionEntry.identity,
            processModelId,
            offset,
            limit,
          );

          resolve(taskList);
        } catch (error) {
          reject(error);
        }
      },
    );
  }

  private async getTasksForCorrelation(
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<SuspendedTaskList> {
    return new Bluebird.Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        try {
          const taskList: SuspendedTaskList = await this.dashboardService.getSuspendedTasksForCorrelation(
            this.activeSolutionEntry.identity,
            correlationId,
            offset,
            limit,
          );

          resolve(taskList);
        } catch (error) {
          reject(error);
        }
      },
    );
  }

  private async getTasksForProcessInstanceId(
    processInstanceId: string,
    offset?: number,
    limit?: number,
  ): Promise<SuspendedTaskList> {
    return this.dashboardService.getSuspendedTasksForProcessInstance(
      this.activeSolutionEntry.identity,
      processInstanceId,
      offset,
      limit,
    );
  }

  private async updateTasks(): Promise<void> {
    try {
      const paginationGetsDisplayed: boolean = this.totalItems > this.pageSize;
      const pageIndex: number = paginationGetsDisplayed ? this.currentPage - 1 : 0;

      const taskOffset: number = pageIndex * this.pageSize;

      this.updatePromise = this.getTasks(taskOffset, this.pageSize);

      const suspendedTaskList: SuspendedTaskList = await this.updatePromise;

      this.tasks = suspendedTaskList.taskListEntries;
      this.totalItems = suspendedTaskList.totalCount;
      this.initialLoadingFinished = true;
      this.showError = false;

      this.paginationShowsLoading = false;
    } catch (error) {
      this.tasks = [];
      this.totalItems = 0;
      this.initialLoadingFinished = true;

      const errorIsForbiddenError: boolean = isError(error, ForbiddenError);
      const errorIsUnauthorizedError: boolean = isError(error, UnauthorizedError);
      const errorIsAuthenticationRelated: boolean = errorIsForbiddenError || errorIsUnauthorizedError;

      if (!errorIsAuthenticationRelated) {
        this.showError = true;
      }
    }
  }
}
