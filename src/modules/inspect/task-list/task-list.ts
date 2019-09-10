import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {ForbiddenError, NotFoundError, UnauthorizedError, isError} from '@essential-projects/errors_ts';
import {DataModels, IManagementApi} from '@process-engine/management_api_contracts';

import {AuthenticationStateEvent, ISolutionEntry, ISolutionService} from '../../../contracts/index';

interface ITaskListRouteParameters {
  processInstanceId?: string;
  diagramName?: string;
  correlationId?: string;
}

type TaskSource =
  | DataModels.EmptyActivities.EmptyActivity
  | DataModels.ManualTasks.ManualTask
  | DataModels.UserTasks.UserTask;

enum TaskType {
  UserTask = 'UserTask',
  ManualTask = 'ManualTask',
  EmptyActivity = 'EmptyActivity',
}

type TaskListEntry = {
  id: string;
  flowNodeInstanceId?: string;
  name: string;
  correlationId: string;
  processModelId: string;
  processInstanceId: string;
  taskType: TaskType;
};

@inject(EventAggregator, 'ManagementApiClientService', Router, 'SolutionService')
export class TaskList {
  @bindable() public activeSolutionEntry: ISolutionEntry;

  public currentPage: number = 0;
  public pageSize: number = 10;
  public totalItems: number;
  public paginationSize: number = 10;

  public requestSuccessful: boolean = false;
  public showError: boolean = false;

  private activeSolutionUri: string;
  private eventAggregator: EventAggregator;
  private managementApiService: IManagementApi;
  private router: Router;
  private solutionService: ISolutionService;

  private subscriptions: Array<Subscription>;
  private tasks: Array<TaskListEntry> = [];
  private getTasks: () => Promise<Array<TaskListEntry>>;
  private isAttached: boolean = false;

  constructor(
    eventAggregator: EventAggregator,
    managementApiService: IManagementApi,
    router: Router,
    solutionService: ISolutionService,
  ) {
    this.eventAggregator = eventAggregator;
    this.managementApiService = managementApiService;
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

  public async activeSolutionEntryChanged(): Promise<void> {
    if (this.isAttached) {
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
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, async () => {
        await this.updateTasks();
      }),
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, async () => {
        await this.updateTasks();
      }),
    ];

    await this.updateTasks();

    this.managementApiService.onEmptyActivityFinished(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.managementApiService.onEmptyActivityWaiting(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.managementApiService.onUserTaskFinished(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.managementApiService.onUserTaskWaiting(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.managementApiService.onManualTaskFinished(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.managementApiService.onManualTaskWaiting(this.activeSolutionEntry.identity, async () => {
      await this.updateTasks();
    });

    this.managementApiService.onProcessError(this.activeSolutionEntry.identity, async () => {
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

  private async getAllTasks(): Promise<Array<TaskListEntry>> {
    const allProcessModels: DataModels.ProcessModels.ProcessModelList = await this.managementApiService.getProcessModels(
      this.activeSolutionEntry.identity,
    );

    // TODO (ph): This will create 1 + n http reqeusts, where n is the number of process models in the processengine.
    const promisesForAllUserTasks: Array<Promise<Array<TaskListEntry>>> = allProcessModels.processModels.map(
      async (processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<TaskListEntry>> => {
        const userTaskList: DataModels.UserTasks.UserTaskList = await this.managementApiService.getUserTasksForProcessModel(
          this.activeSolutionEntry.identity,
          processModel.id,
        );

        return this.mapToTaskListEntry(userTaskList.userTasks, TaskType.UserTask);
      },
    );

    const promisesForAllManualTasks: Array<Promise<Array<TaskListEntry>>> = allProcessModels.processModels.map(
      async (processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<TaskListEntry>> => {
        const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.managementApiService.getManualTasksForProcessModel(
          this.activeSolutionEntry.identity,
          processModel.id,
        );

        return this.mapToTaskListEntry(manualTaskList.manualTasks, TaskType.ManualTask);
      },
    );

    const promisesForAllEmptyActivities: Array<Promise<Array<TaskListEntry>>> = allProcessModels.processModels.map(
      async (processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<TaskListEntry>> => {
        const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this.managementApiService.getEmptyActivitiesForProcessModel(
          this.activeSolutionEntry.identity,
          processModel.id,
        );

        return this.mapToTaskListEntry(emptyActivityList.emptyActivities, TaskType.EmptyActivity);
      },
    );
    // Concatenate the Promises for requesting UserTasks and requesting ManualTasks.
    const promisesForAllTasksForAllProcessModels: Array<TaskListEntry> = [].concat(
      promisesForAllUserTasks,
      promisesForAllManualTasks,
      promisesForAllEmptyActivities,
    );

    // Await all promises.
    const allTasksForAllProcessModels: Array<TaskListEntry> = await Promise.all(promisesForAllTasksForAllProcessModels);

    // Flatten all results.
    const allTasks: Array<TaskListEntry> = [].concat(...allTasksForAllProcessModels);

    return allTasks;
  }

  private async getTasksForProcessModel(processModelId: string): Promise<Array<TaskListEntry>> {
    const userTaskList: DataModels.UserTasks.UserTaskList = await this.managementApiService.getUserTasksForProcessModel(
      this.activeSolutionEntry.identity,
      processModelId,
    );

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.managementApiService.getManualTasksForProcessModel(
      this.activeSolutionEntry.identity,
      processModelId,
    );

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this.managementApiService.getEmptyActivitiesForProcessModel(
      this.activeSolutionEntry.identity,
      processModelId,
    );

    const userTasks: Array<TaskListEntry> = this.mapToTaskListEntry(userTaskList.userTasks, TaskType.UserTask);
    const manualTasks: Array<TaskListEntry> = this.mapToTaskListEntry(manualTaskList.manualTasks, TaskType.ManualTask);
    const emptyActivities: Array<TaskListEntry> = this.mapToTaskListEntry(
      emptyActivityList.emptyActivities,
      TaskType.EmptyActivity,
    );

    return [].concat(userTasks, manualTasks, emptyActivities);
  }

  private async getTasksForCorrelation(correlationId: string): Promise<Array<TaskListEntry>> {
    const runningCorrelations: Array<
      DataModels.Correlations.Correlation
    > = await this.managementApiService.getActiveCorrelations(this.activeSolutionEntry.identity);

    const correlation: DataModels.Correlations.Correlation = runningCorrelations.find(
      (otherCorrelation: DataModels.Correlations.Correlation) => {
        return otherCorrelation.id === correlationId;
      },
    );

    const correlationWasNotFound: boolean = correlation === undefined;
    if (correlationWasNotFound) {
      throw new NotFoundError(`No correlation found with id ${correlationId}.`);
    }

    const userTaskList: DataModels.UserTasks.UserTaskList = await this.managementApiService.getUserTasksForCorrelation(
      this.activeSolutionEntry.identity,
      correlationId,
    );

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.managementApiService.getManualTasksForCorrelation(
      this.activeSolutionEntry.identity,
      correlationId,
    );

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this.managementApiService.getEmptyActivitiesForCorrelation(
      this.activeSolutionEntry.identity,
      correlationId,
    );

    const userTasks: Array<TaskListEntry> = this.mapToTaskListEntry(userTaskList.userTasks, TaskType.UserTask);

    const manualTasks: Array<TaskListEntry> = this.mapToTaskListEntry(manualTaskList.manualTasks, TaskType.ManualTask);

    const emptyActivities: Array<TaskListEntry> = this.mapToTaskListEntry(
      emptyActivityList.emptyActivities,
      TaskType.EmptyActivity,
    );

    return [].concat(userTasks, manualTasks, emptyActivities);
  }

  private async getTasksForProcessInstanceId(processInstanceId: string): Promise<Array<TaskListEntry>> {
    const userTaskList: DataModels.UserTasks.UserTaskList = await this.managementApiService.getUserTasksForProcessInstance(
      this.activeSolutionEntry.identity,
      processInstanceId,
    );

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.managementApiService.getManualTasksForProcessInstance(
      this.activeSolutionEntry.identity,
      processInstanceId,
    );

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this.managementApiService.getEmptyActivitiesForProcessInstance(
      this.activeSolutionEntry.identity,
      processInstanceId,
    );

    const userTasksAndProcessModels: Array<TaskListEntry> = this.mapToTaskListEntry(
      userTaskList.userTasks,
      TaskType.UserTask,
    );
    const manualTasks: Array<TaskListEntry> = this.mapToTaskListEntry(manualTaskList.manualTasks, TaskType.ManualTask);
    const emptyActivities: Array<TaskListEntry> = this.mapToTaskListEntry(
      emptyActivityList.emptyActivities,
      TaskType.EmptyActivity,
    );

    return [].concat(userTasksAndProcessModels, manualTasks, emptyActivities);
  }

  private mapToTaskListEntry(tasks: Array<TaskSource>, targetType: TaskType): Array<TaskListEntry> {
    const mappedTasks: Array<TaskListEntry> = tasks.map(
      (task: TaskSource): TaskListEntry => {
        return {
          correlationId: task.correlationId,
          id: task.id,
          flowNodeInstanceId: task.flowNodeInstanceId,
          processInstanceId: task.processInstanceId,
          processModelId: task.processModelId,
          name: task.name,
          // NOTE: Can't use instanceof or typeof, because the tasks were received as a plain JSON that does not have any type infos.
          // TODO: Add type mapping to the Management API Client.
          taskType: targetType,
        };
      },
    );

    return mappedTasks;
  }

  private async updateTasks(): Promise<void> {
    try {
      this.tasks = await this.getTasks();
      this.requestSuccessful = true;
    } catch (error) {
      this.tasks = [];
      this.requestSuccessful = true;

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
