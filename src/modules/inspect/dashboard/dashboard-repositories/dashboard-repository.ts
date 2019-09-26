import {DataModels, IManagementApiClient, Messages} from '@process-engine/management_api_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {NotFoundError} from '@essential-projects/errors_ts';
import {IDashboardRepository} from '../contracts/IDashboardRepository';
import {TaskListEntry, TaskSource, TaskType} from '../contracts/index';

export class DashboardRepository implements IDashboardRepository {
  protected managementApiService: IManagementApiClient;

  constructor(managementApi: IManagementApiClient) {
    this.managementApiService = managementApi;
  }

  public async getAllActiveCronjobs(identity: IIdentity): Promise<DataModels.Cronjobs.CronjobList> {
    const result = (await this.managementApiService.getAllActiveCronjobs(identity)) as any;

    return {cronjobs: result, totalCount: result.length};
  }

  public async getProcessModels(identity: IIdentity): Promise<DataModels.ProcessModels.ProcessModelList> {
    const result = await this.managementApiService.getProcessModels(identity);

    return {processModels: result.processModels, totalCount: result.processModels.length};
  }

  public async getActiveCorrelations(identity: IIdentity): Promise<DataModels.Correlations.CorrelationList> {
    const result = (await this.managementApiService.getActiveCorrelations(identity)) as any;

    return {correlations: result, totalCount: result.length};
  }

  public async getManualTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    const result = await this.managementApiService.getManualTasksForProcessModel(identity, processModelId);

    return {manualTasks: result.manualTasks, totalCount: result.manualTasks.length};
  }

  public async getEmptyActivitiesForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    const result = await this.managementApiService.getEmptyActivitiesForProcessModel(identity, processModelId);

    return {emptyActivities: result.emptyActivities, totalCount: result.emptyActivities.length};
  }

  public async getUserTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    const result = await this.managementApiService.getUserTasksForProcessModel(identity, processModelId);

    return {userTasks: result.userTasks, totalCount: result.userTasks.length};
  }

  public async getManualTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    const result = await this.managementApiService.getManualTasksForCorrelation(identity, correlationId);

    return {manualTasks: result.manualTasks, totalCount: result.manualTasks.length};
  }

  public async getEmptyActivitiesForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    const result = await this.managementApiService.getEmptyActivitiesForCorrelation(identity, correlationId);

    return {emptyActivities: result.emptyActivities, totalCount: result.emptyActivities.length};
  }

  public async getUserTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    const result = await this.managementApiService.getUserTasksForCorrelation(identity, correlationId);

    return {userTasks: result.userTasks, totalCount: result.userTasks.length};
  }

  public async getManualTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    const result = await this.managementApiService.getManualTasksForProcessInstance(identity, correlationId);

    return {manualTasks: result.manualTasks, totalCount: result.manualTasks.length};
  }

  public async getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    const result = await this.managementApiService.getEmptyActivitiesForProcessInstance(identity, correlationId);

    return {emptyActivities: result.emptyActivities, totalCount: result.emptyActivities.length};
  }

  public async getUserTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    const result = await this.managementApiService.getUserTasksForProcessInstance(identity, correlationId);

    return {userTasks: result.userTasks, totalCount: result.userTasks.length};
  }

  public terminateProcessInstance(identity: IIdentity, processInstanceId: string): Promise<void> {
    return this.managementApiService.terminateProcessInstance(identity, processInstanceId);
  }

  public onProcessEnded(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onProcessEnded(
      identity,
      (message: Messages.BpmnEvents.EndEventReachedMessage): void => {
        callback();
      },
    );
  }

  public onProcessStarted(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onProcessStarted(
      identity,
      (processStarted: Messages.SystemEvents.ProcessStartedMessage): void => {
        callback();
      },
    );
  }

  public onProcessError(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onProcessError(
      identity,
      (message: Messages.SystemEvents.ProcessErrorMessage): void => {
        callback();
      },
    );
  }

  public onEmptyActivityFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onEmptyActivityFinished(
      identity,
      (message: Messages.SystemEvents.EmptyActivityFinishedMessage): void => {
        callback();
      },
    );
  }

  public onEmptyActivityWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onEmptyActivityWaiting(
      identity,
      (message: Messages.SystemEvents.EmptyActivityReachedMessage): void => {
        callback();
      },
    );
  }

  public onManualTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onManualTaskFinished(
      identity,
      (message: Messages.SystemEvents.ManualTaskFinishedMessage): void => {
        callback();
      },
    );
  }

  public onManualTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onManualTaskWaiting(
      identity,
      (message: Messages.SystemEvents.ManualTaskReachedMessage): void => {
        callback();
      },
    );
  }

  public onUserTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onUserTaskFinished(
      identity,
      (message: Messages.SystemEvents.UserTaskFinishedMessage): void => {
        callback();
      },
    );
  }

  public onUserTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiService.onUserTaskWaiting(
      identity,
      (message: Messages.SystemEvents.UserTaskReachedMessage): void => {
        callback();
      },
    );
  }

  public finishManualTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    manualTaskInstanceId: string,
  ): Promise<void> {
    return this.managementApiService.finishManualTask(identity, processInstanceId, correlationId, manualTaskInstanceId);
  }

  public finishUserTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    userTaskInstanceId: string,
    userTaskResult: DataModels.UserTasks.UserTaskResult,
  ): Promise<void> {
    return this.managementApiService.finishUserTask(
      identity,
      processInstanceId,
      correlationId,
      userTaskInstanceId,
      userTaskResult,
    );
  }

  public removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void> {
    return this.managementApiService.removeSubscription(identity, subscription);
  }

  public async getAllSuspendedTasks(identity: IIdentity): Promise<Array<TaskListEntry>> {
    const allProcessModels: DataModels.ProcessModels.ProcessModelList = await this.getProcessModels(identity);

    // TODO (ph): This will create 1 + n http reqeusts, where n is the number of process models in the processengine.
    const promisesForAllUserTasks: Array<Promise<Array<TaskListEntry>>> = allProcessModels.processModels.map(
      async (processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<TaskListEntry>> => {
        const userTaskList: DataModels.UserTasks.UserTaskList = await this.getUserTasksForProcessModel(
          identity,
          processModel.id,
        );

        return this.mapTasksToTaskListEntry(userTaskList.userTasks, TaskType.UserTask);
      },
    );

    const promisesForAllManualTasks: Array<Promise<Array<TaskListEntry>>> = allProcessModels.processModels.map(
      async (processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<TaskListEntry>> => {
        const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.getManualTasksForProcessModel(
          identity,
          processModel.id,
        );

        return this.mapTasksToTaskListEntry(manualTaskList.manualTasks, TaskType.ManualTask);
      },
    );

    const promisesForAllEmptyActivities: Array<Promise<Array<TaskListEntry>>> = allProcessModels.processModels.map(
      async (processModel: DataModels.ProcessModels.ProcessModel): Promise<Array<TaskListEntry>> => {
        const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this.getEmptyActivitiesForProcessModel(
          identity,
          processModel.id,
        );

        return this.mapTasksToTaskListEntry(emptyActivityList.emptyActivities, TaskType.EmptyActivity);
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

  public async getSuspendedTasksForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<Array<TaskListEntry>> {
    const userTaskList: DataModels.UserTasks.UserTaskList = await this.getUserTasksForProcessInstance(
      identity,
      processInstanceId,
    );

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.getManualTasksForProcessInstance(
      identity,
      processInstanceId,
    );

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this.getEmptyActivitiesForProcessInstance(
      identity,
      processInstanceId,
    );

    const userTasksAndProcessModels: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      userTaskList.userTasks,
      TaskType.UserTask,
    );
    const manualTasks: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      manualTaskList.manualTasks,
      TaskType.ManualTask,
    );
    const emptyActivities: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      emptyActivityList.emptyActivities,
      TaskType.EmptyActivity,
    );

    return [].concat(userTasksAndProcessModels, manualTasks, emptyActivities);
  }

  public async getSuspendedTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<Array<TaskListEntry>> {
    const runningCorrelations: DataModels.Correlations.CorrelationList = await this.getActiveCorrelations(identity);

    const correlation: DataModels.Correlations.Correlation = runningCorrelations.correlations.find(
      (otherCorrelation: DataModels.Correlations.Correlation) => {
        return otherCorrelation.id === correlationId;
      },
    );

    const correlationWasNotFound: boolean = correlation === undefined;
    if (correlationWasNotFound) {
      throw new NotFoundError(`No correlation found with id ${correlationId}.`);
    }

    const userTaskList: DataModels.UserTasks.UserTaskList = await this.getUserTasksForCorrelation(
      identity,
      correlationId,
    );

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.getManualTasksForCorrelation(
      identity,
      correlationId,
    );

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this.getEmptyActivitiesForCorrelation(
      identity,
      correlationId,
    );

    const userTasks: Array<TaskListEntry> = this.mapTasksToTaskListEntry(userTaskList.userTasks, TaskType.UserTask);

    const manualTasks: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      manualTaskList.manualTasks,
      TaskType.ManualTask,
    );

    const emptyActivities: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      emptyActivityList.emptyActivities,
      TaskType.EmptyActivity,
    );

    return [].concat(userTasks, manualTasks, emptyActivities);
  }

  public async getSuspendedTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<Array<TaskListEntry>> {
    const userTaskList: DataModels.UserTasks.UserTaskList = await this.getUserTasksForProcessModel(
      identity,
      processModelId,
    );

    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.getManualTasksForProcessModel(
      identity,
      processModelId,
    );

    const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = await this.getEmptyActivitiesForProcessModel(
      identity,
      processModelId,
    );

    const userTasks: Array<TaskListEntry> = this.mapTasksToTaskListEntry(userTaskList.userTasks, TaskType.UserTask);
    const manualTasks: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      manualTaskList.manualTasks,
      TaskType.ManualTask,
    );
    const emptyActivities: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      emptyActivityList.emptyActivities,
      TaskType.EmptyActivity,
    );

    return [].concat(userTasks, manualTasks, emptyActivities);
  }

  private mapTasksToTaskListEntry(tasks: Array<TaskSource>, targetType: TaskType): Array<TaskListEntry> {
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
}
