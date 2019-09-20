import {Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {ForbiddenError, UnauthorizedError, isError} from '@essential-projects/errors_ts';

import {AuthenticationStateEvent, ISolutionEntry, ISolutionService} from '../../../contracts/index';
import environment from '../../../environment';
import {IDashboardService, TaskListEntry} from '../dashboard/contracts/index';

interface ITaskListRouteParameters {
  processInstanceId?: string;
  diagramName?: string;
  correlationId?: string;
}

@inject('DashboardService', Router, 'SolutionService')
export class TaskList {
  @bindable() public activeSolutionEntry: ISolutionEntry;

  public currentPage: number = 0;
  public pageSize: number = 10;
  public totalItems: number;
  public paginationSize: number = 10;

  public initialLoadingFinished: boolean = false;
  public showError: boolean = false;

  private activeSolutionUri: string;
  private dashboardService: IDashboardService;
  private router: Router;
  private solutionService: ISolutionService;

  private subscriptions: Array<Subscription>;
  private tasks: Array<TaskListEntry> = [];
  private getTasks: () => Promise<Array<TaskListEntry>>;
  private isAttached: boolean = false;

  constructor(dashboardService: IDashboardService, router: Router, solutionService: ISolutionService) {
    this.dashboardService = dashboardService;
    this.router = router;
    this.solutionService = solutionService;
  }

  public get shownTasks(): Array<TaskListEntry> {
    return this.tasks.slice((this.currentPage - 1) * this.pageSize, this.pageSize * this.currentPage);
  }

  public initializeTaskList(routeParameters: ITaskListRouteParameters): void {
    const diagramName: string = routeParameters.diagramName;
    const correlationId: string = routeParameters.correlationId;
    const processInstanceId: string = routeParameters.processInstanceId;

    const hasDiagramName: boolean = diagramName !== undefined;
    const hasCorrelationId: boolean = correlationId !== undefined;
    const hasProcessInstanceId: boolean = processInstanceId !== undefined;

    if (hasDiagramName) {
      this.getTasks = (): Promise<Array<TaskListEntry>> => {
        return this.getTasksForProcessModel(diagramName);
      };
    } else if (hasCorrelationId) {
      this.getTasks = (): Promise<Array<TaskListEntry>> => {
        return this.getTasksForCorrelation(correlationId);
      };
    } else if (hasProcessInstanceId) {
      this.getTasks = (): Promise<Array<TaskListEntry>> => {
        return this.getTasksForProcessInstanceId(processInstanceId);
      };
    } else {
      this.getTasks = this.getAllTasks;
    }
  }

  public async activeSolutionEntryChanged(newValue): Promise<void> {
    if (this.isAttached) {
      this.tasks = [];
      this.initialLoadingFinished = false;
      this.showError = false;
      this.dashboardService.eventAggregator.publish(environment.events.configPanel.solutionEntryChanged, newValue);

      await this.updateTasks();
    }
  }

  public async attached(): Promise<void> {
    const getTasksIsUndefined: boolean = this.getTasks === undefined;

    this.activeSolutionUri = this.router.currentInstruction.queryParams.solutionUri;

    const activeSolutionUriIsNotSet: boolean = this.activeSolutionUri === undefined;

    if (activeSolutionUriIsNotSet) {
      this.activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(this.activeSolutionUri);

    if (getTasksIsUndefined) {
      this.getTasks = this.getAllTasks;
    }

    this.subscriptions = [
      this.dashboardService.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, async () => {
        await this.updateTasks();
      }),
      this.dashboardService.eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, async () => {
        await this.updateTasks();
      }),
    ];

    await this.updateTasks();

    this.dashboardService.onEmptyActivityFinished(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.dashboardService.onEmptyActivityWaiting(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.dashboardService.onUserTaskFinished(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.dashboardService.onUserTaskWaiting(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.dashboardService.onManualTaskFinished(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.dashboardService.onManualTaskWaiting(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.dashboardService.onProcessError(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.isAttached = true;
  }

  public detached(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }

    this.isAttached = false;
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

  private getAllTasks(): Promise<Array<TaskListEntry>> {
    return this.dashboardService.getAllSuspendedTasks(this.activeSolutionEntry.identity);
  }

  private async getTasksForProcessModel(processModelId: string): Promise<Array<TaskListEntry>> {
    return this.dashboardService.getSuspendedTasksForProcessModel(this.activeSolutionEntry.identity, processModelId);
  }

  private async getTasksForCorrelation(correlationId: string): Promise<Array<TaskListEntry>> {
    return this.dashboardService.getSuspendedTasksForCorrelation(this.activeSolutionEntry.identity, correlationId);
  }

  private async getTasksForProcessInstanceId(processInstanceId: string): Promise<Array<TaskListEntry>> {
    return this.dashboardService.getSuspendedTasksForProcessInstance(
      this.activeSolutionEntry.identity,
      processInstanceId,
    );
  }

  private async updateTasks(): Promise<void> {
    try {
      this.tasks = await this.getTasks();
      this.initialLoadingFinished = true;
    } catch (error) {
      this.tasks = [];
      this.initialLoadingFinished = true;

      const errorIsForbiddenError: boolean = isError(error, ForbiddenError);
      const errorIsUnauthorizedError: boolean = isError(error, UnauthorizedError);
      const errorIsAuthenticationRelated: boolean = errorIsForbiddenError || errorIsUnauthorizedError;

      if (!errorIsAuthenticationRelated) {
        this.showError = true;
      }
    }

    this.totalItems = this.tasks.length;
  }
}
