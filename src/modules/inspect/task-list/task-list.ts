import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {isError, NotFoundError, UnauthorizedError} from '@essential-projects/errors_ts';
import {DataModels, IManagementApi} from '@process-engine/management_api_contracts';

import {
  AuthenticationStateEvent,
  ISolutionEntry,
  ISolutionService,
  NotificationType,
} from '../../../contracts/index';
import environment from '../../../environment';
import {NotificationService} from '../../../services/notification-service/notification.service';

interface ITaskListRouteParameters {
  processInstanceId?: string;
  diagramName?: string;
  correlationId?: string;
}

type ProcessModelAnnotation = {processModel: DataModels.ProcessModels.ProcessModel};
type ManualTaskWithProcessModel = DataModels.ManualTasks.ManualTask & ProcessModelAnnotation;
type UserTaskWithProcessModel = DataModels.UserTasks.UserTask & ProcessModelAnnotation;
type EmptyActivityWithProcessModel = DataModels.EmptyActivities.EmptyActivity & ProcessModelAnnotation;

type Task = ManualTaskWithProcessModel
          | UserTaskWithProcessModel
          | EmptyActivityWithProcessModel;

@inject(EventAggregator, 'ManagementApiClientService', Router, 'NotificationService', 'SolutionService')
export class TaskList {

  @bindable() public activeSolutionEntry: ISolutionEntry;

  public currentPage: number = 0;
  public pageSize: number = 10;
  public totalItems: number;
  public paginationSize: number = 10;

  public requestSuccessful: boolean = false;

  private _activeSolutionUri: string;
  private _eventAggregator: EventAggregator;
  private _managementApiService: IManagementApi;
  private _router: Router;
  private _notificationService: NotificationService;
  private _solutionService: ISolutionService;

  private _subscriptions: Array<Subscription>;
  private _tasks: Array<Task>;
  private _pollingTimeout: NodeJS.Timer | number;
  private _getTasks: () => Promise<Array<Task>>;
  private _isAttached: boolean = false;

  constructor(eventAggregator: EventAggregator,
              managementApiService: IManagementApi,
              router: Router,
              notificationService: NotificationService,
              solutionService: ISolutionService,
  ) {
    this._eventAggregator = eventAggregator;
    this._managementApiService = managementApiService;
    this._router = router;
    this._notificationService = notificationService;
    this._solutionService = solutionService;
  }

  public initializeTaskList(routeParameters: ITaskListRouteParameters): void {
    const diagramName: string = routeParameters.diagramName;
    const correlationId: string = routeParameters.correlationId;
    const processInstanceId: string = routeParameters.processInstanceId;

    const hasDiagramName: boolean = diagramName !== undefined;
    const hasCorrelationId: boolean = correlationId !== undefined;
    const hasProcessInstanceId: boolean = processInstanceId !== undefined;

    if (hasDiagramName) {
      this._getTasks = (): Promise<Array<Task>> => {
        return this._getTasksForProcessModel(diagramName);
      };
    } else if (hasCorrelationId) {
      this._getTasks = (): Promise<Array<Task>> => {
        return this._getTasksForCorrelation(correlationId);
      };
    } else if (hasProcessInstanceId) {
      this._getTasks = (): Promise<Array<Task>> => {
        return this._getTasksForProcessInstanceId(processInstanceId);
      };
    } else {
      this._getTasks = this._getAllTasks;
    }
  }

  public async attached(): Promise<void> {
    this._isAttached = true;

    const getTasksIsUndefined: boolean = this._getTasks === undefined;

    this._activeSolutionUri = this._router.currentInstruction.queryParams.solutionUri;

    const activeSolutionUriIsNotSet: boolean = this._activeSolutionUri === undefined;

    if (activeSolutionUriIsNotSet) {
      this._activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    this.activeSolutionEntry = this._solutionService.getSolutionEntryForUri(this._activeSolutionUri);

    if (getTasksIsUndefined) {
      this._getTasks = this._getAllTasks;
    }

    this._subscriptions = [
      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, async() => {
        await this.updateTasks();
      }),
      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, async() => {
        await this.updateTasks();
      }),
    ];

    await this.updateTasks();
    this._startPolling();
  }

  private _startPolling(): void {
    this._pollingTimeout = setTimeout(async() => {
      await this.updateTasks();

      if (this ._isAttached) {
        this._startPolling();
      }
    }, environment.processengine.dashboardPollingIntervalInMs);
  }

  public detached(): void {
    this._isAttached = false;
    clearTimeout(this._pollingTimeout as NodeJS.Timer);

    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }

  public goBack(): void {
    this._router.navigateBack();
  }

  public continueTask(taskWithProcessModel: Task): void {
    const {correlationId, id, processInstanceId} = taskWithProcessModel;

    const tasksProcessModelId: string = taskWithProcessModel.processModelId;

    const taskIsFromCallActivity: boolean = taskWithProcessModel.processModel.id !== tasksProcessModelId;

    const processModelId: string = taskIsFromCallActivity
                                 ? tasksProcessModelId
                                 : taskWithProcessModel.processModel.id;

    this._router.navigateToRoute('live-execution-tracker', {
      diagramName: processModelId,
      solutionUri: this.activeSolutionEntry.uri,
      correlationId: correlationId,
      processInstanceId: processInstanceId,
      taskId: id,
    });
  }

  public get shownTasks(): Array<Task> {
    return this.tasks.slice((this.currentPage - 1) * this.pageSize, this.pageSize * this.currentPage);
  }

  public get tasks(): Array<Task> {
    const noTasksExisitng: boolean = this._tasks === undefined;
    if (noTasksExisitng) {
      return [];
    }

    return this._tasks;
  }

  private async _getAllTasks(): Promise<Array<Task>> {

    const allProcessModels: DataModels.ProcessModels.ProcessModelList = await this._managementApiService
      .getProcessModels(this.activeSolutionEntry.identity);

    // TODO (ph): This will create 1 + n http reqeusts, where n is the number of process models in the processengine.
    const promisesForAllUserTasks: Array<Promise<Array<Task>>> = allProcessModels.processModels
      .map(async(processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<Task>> => {
        const userTaskList: DataModels.UserTasks.UserTaskList = await this._managementApiService
          .getUserTasksForProcessModel(this.activeSolutionEntry.identity, processModel.id);

        const userTasksAndProcessModels: Array<Task> = this._addProcessModelToUserTasks(userTaskList, processModel);

        return userTasksAndProcessModels;
      });

    const promisesForAllManualTasks: Array<Promise<Array<Task>>> = allProcessModels.processModels
      .map(async(processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<Task>> => {
        const manualTaskList: DataModels.ManualTasks.ManualTaskList =
          await this._managementApiService.getManualTasksForProcessModel(this.activeSolutionEntry.identity, processModel.id);

        const manualTasksAndProcessModels: Array<Task> = this._addProcessModelToManualTasks(manualTaskList, processModel);

        return manualTasksAndProcessModels;
      });

    const promisesForAllEmptyActivities: Array<Promise<Array<Task>>> = allProcessModels.processModels
      .map(async(processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<Task>> => {
        const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList =
          await this._managementApiService.getEmptyActivitiesForProcessModel(this.activeSolutionEntry.identity, processModel.id);

        const emptyActivitiesAndProcessModels: Array<Task> =
          this._addProcessModelToEmptyActivity(emptyActivityList, processModel);

        return emptyActivitiesAndProcessModels;
      });
    // Concatenate the Promises for requesting UserTasks and requesting ManualTasks.
    const promisesForAllTasksForAllProcessModels: Array<Task> = []
      .concat(promisesForAllUserTasks, promisesForAllManualTasks, promisesForAllEmptyActivities);

    // Await all promises.
    const allTasksForAllProcessModels: Array<Task> =
      await Promise.all(promisesForAllTasksForAllProcessModels);

    // Flatten all results.
    const allTasks: Array<Task> = [].concat(...allTasksForAllProcessModels);

    return allTasks;
  }

  private async _getTasksForProcessModel(processModelId: string): Promise<Array<Task>> {

    const processModel: DataModels.ProcessModels.ProcessModel = await
      this
        ._managementApiService
        .getProcessModelById(this.activeSolutionEntry.identity, processModelId);

    const userTaskList: DataModels.UserTasks.UserTaskList =
      await this._managementApiService.getUserTasksForProcessModel(this.activeSolutionEntry.identity, processModelId);

    const manualTaskList: DataModels.ManualTasks.ManualTaskList =
      await this._managementApiService.getManualTasksForProcessModel(this.activeSolutionEntry.identity, processModelId);

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList =
      await this._managementApiService.getEmptyActivitiesForProcessModel(this.activeSolutionEntry.identity, processModelId);

    const userTasksAndProcessModels: Array<Task> = this._addProcessModelToUserTasks(userTaskList, processModel);
    const manualTasksAndProcessModels: Array<Task> = this._addProcessModelToManualTasks(manualTaskList, processModel);
    const emptyActivitiesAndProcessModels: Array<Task> = this._addProcessModelToEmptyActivity(emptyActivityList, processModel);

    return [].concat(userTasksAndProcessModels, manualTasksAndProcessModels, emptyActivitiesAndProcessModels);
  }

  private async _getTasksForCorrelation(correlationId: string): Promise<Array<Task>> {

    const runningCorrelations: Array<DataModels.Correlations.Correlation> =
      await this._managementApiService.getActiveCorrelations(this.activeSolutionEntry.identity);

    const correlation: DataModels.Correlations.Correlation = runningCorrelations.find((otherCorrelation: DataModels.Correlations.Correlation) => {
      return otherCorrelation.id === correlationId;
    });

    const correlationWasNotFound: boolean = correlation === undefined;
    if (correlationWasNotFound) {
      throw new NotFoundError(`No correlation found with id ${correlationId}.`);
    }

    const userTaskList: DataModels.UserTasks.UserTaskList =
      await this._managementApiService.getUserTasksForCorrelation(this.activeSolutionEntry.identity, correlationId);

    const manualTaskList: DataModels.ManualTasks.ManualTaskList =
      await this._managementApiService.getManualTasksForCorrelation(this.activeSolutionEntry.identity, correlationId);

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList =
      await this._managementApiService.getEmptyActivitiesForCorrelation(this.activeSolutionEntry.identity, correlationId);

    // TODO: This needs to be refactored so that the correct ProcessModel will be used depending on the user task
    const correlationProcessInstanceId: string = correlation.processInstances[0].processModelId;
    const processModelOfCorrelation: DataModels.ProcessModels.ProcessModel =
      await this._managementApiService.getProcessModelById(this.activeSolutionEntry.identity, correlationProcessInstanceId);

    const userTasksAndProcessModels: Array<Task> =
      this._addProcessModelToUserTasks(userTaskList, processModelOfCorrelation);

    const manualTasksAndProcessModels: Array<Task> =
      this._addProcessModelToManualTasks(manualTaskList, processModelOfCorrelation);

    const emptyActivitiesAndProcessModels: Array<Task> =
      this._addProcessModelToEmptyActivity(emptyActivityList, processModelOfCorrelation);

    return [].concat(userTasksAndProcessModels, manualTasksAndProcessModels, emptyActivitiesAndProcessModels);
  }

  private async _getTasksForProcessInstanceId(processInstanceId: string): Promise<Array<Task>> {

    const userTaskList: DataModels.UserTasks.UserTaskList =
      await this._managementApiService.getUserTasksForProcessInstance(this.activeSolutionEntry.identity, processInstanceId);

    const manualTaskList: DataModels.ManualTasks.ManualTaskList =
      await this._managementApiService.getManualTasksForProcessInstance(this.activeSolutionEntry.identity, processInstanceId);

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList =
      await this._managementApiService.getEmptyActivitiesForProcessInstance(this.activeSolutionEntry.identity, processInstanceId);

    const processModel: DataModels.ProcessModels.ProcessModel = await
      this
        ._managementApiService
        .getProcessModelByProcessInstanceId(this.activeSolutionEntry.identity, processInstanceId);

    const userTasksAndProcessModels: Array<Task> = this._addProcessModelToUserTasks(userTaskList, processModel);
    const manualTasksAndProcessModels: Array<Task> = this._addProcessModelToManualTasks(manualTaskList, processModel);
    const emptyActivitiesAndProcessModels: Array<Task> = this._addProcessModelToEmptyActivity(emptyActivityList, processModel);

    return [].concat(userTasksAndProcessModels, manualTasksAndProcessModels, emptyActivitiesAndProcessModels);
  }

  private _addProcessModelToUserTasks(
    userTaskList: DataModels.UserTasks.UserTaskList,
    processModel: DataModels.ProcessModels.ProcessModel,
  ): Array<Task> {

    const userTasksAndProcessModels: Array<Task> = userTaskList.userTasks
      .map((userTask: DataModels.UserTasks.UserTask): Task => ({
        processModel: processModel,
        correlationId: userTask.correlationId,
        id: userTask.id,
        flowNodeInstanceId: userTask.flowNodeInstanceId,
        processInstanceId: userTask.processInstanceId,
        processModelId: userTask.processModelId,
        name: userTask.name,
        tokenPayload: userTask.tokenPayload,
        data: userTask.data,
      }));

    return userTasksAndProcessModels;
  }

  private _addProcessModelToManualTasks(
    manualTaskList: DataModels.ManualTasks.ManualTaskList,
    processModel: DataModels.ProcessModels.ProcessModel,
  ): Array<Task> {

    const manualTasksAndProcessModels: Array<Task> = manualTaskList.manualTasks
      .map((manualTask: DataModels.ManualTasks.ManualTask): Task => ({
        processModel: processModel,
        correlationId: manualTask.correlationId,
        id: manualTask.id,
        flowNodeInstanceId: manualTask.flowNodeInstanceId,
        processInstanceId: manualTask.processInstanceId,
        processModelId: manualTask.processModelId,
        name: manualTask.name,
        tokenPayload: manualTask.tokenPayload,
      }));

    return manualTasksAndProcessModels;
  }

  private _addProcessModelToEmptyActivity(
    emptyActivityList: DataModels.EmptyActivities.EmptyActivityList,
    processModel: DataModels.ProcessModels.ProcessModel,
  ): Array<Task> {

    const emptyActivitiesAndProcessModels: Array<Task> = emptyActivityList.emptyActivities
      .map((emptyActivity: DataModels.EmptyActivities.EmptyActivity): Task => ({
        processModel: processModel,
        correlationId: emptyActivity.correlationId,
        id: emptyActivity.id,
        flowNodeInstanceId: emptyActivity.flowNodeInstanceId,
        processInstanceId: emptyActivity.processInstanceId,
        processModelId: emptyActivity.processModelId,
        name: emptyActivity.name,
        tokenPayload: emptyActivity.tokenPayload,
      }));

    return emptyActivitiesAndProcessModels;
  }

  public async updateTasks(): Promise<void> {
    try {
      this._tasks = await this._getTasks();
      this.requestSuccessful = true;
    } catch (error) {

      this.requestSuccessful = false;

      if (isError(error, UnauthorizedError)) {
        this._notificationService.showNotification(NotificationType.ERROR, 'You don\'t have permission to view the task list.');
        this._router.navigateToRoute('start-page');
      } else {
        this._notificationService.showNotification(NotificationType.ERROR, `Error receiving task list: ${error.message}`);
        this._tasks = undefined;
      }
    }

    this.totalItems = this.tasks.length;
  }
}
