import {DataModels, IManagementApiClient, Messages} from '@process-engine/management_api_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {NotFoundError} from '@essential-projects/errors_ts';

import {Correlation} from '@process-engine/management_api_contracts/dist/data_models/correlation';
import {IDashboardRepository} from '../contracts/IDashboardRepository';
import {TaskList, TaskListEntry, TaskSource, TaskType} from '../contracts/index';
import {applyPagination} from '../../../../services/pagination-module/pagination.module';

export class DashboardRepository implements IDashboardRepository {
  protected managementApiClient: IManagementApiClient;

  constructor(managementApiClient: IManagementApiClient) {
    this.managementApiClient = managementApiClient;
  }

  public async getAllActiveCronjobs(
    identity: IIdentity,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.Cronjobs.CronjobList> {
    const cronjobs: Array<DataModels.Cronjobs.CronjobConfiguration> = (await this.managementApiClient.getAllActiveCronjobs(
      identity,
    )) as any;

    return {
      cronjobs: applyPagination(cronjobs, offset, limit),
      totalCount: cronjobs.length,
    };
  }

  public async getAllActiveProcessInstances(
    identity: IIdentity,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.Correlations.ProcessInstanceList> {
    const activeCorrelations: Array<DataModels.Correlations.Correlation> = (await this.getActiveCorrelations(identity))
      .correlations;

    const processInstancesForCorrelations: Array<Array<
      DataModels.Correlations.ProcessInstance
    >> = activeCorrelations.map((correlation) => {
      const processInstances: Array<DataModels.Correlations.ProcessInstance> = correlation.processInstances.map(
        (processInstance) => {
          processInstance.correlationId = correlation.id;

          return processInstance;
        },
      );

      return processInstances;
    });

    const processInstances: Array<DataModels.Correlations.ProcessInstance> = [].concat(
      ...processInstancesForCorrelations,
    );

    return {processInstances: applyPagination(processInstances, offset, limit), totalCount: processInstances.length};
  }

  public async getProcessModels(identity: IIdentity): Promise<DataModels.ProcessModels.ProcessModelList> {
    const result = await this.managementApiClient.getProcessModels(identity);

    return {processModels: result.processModels, totalCount: result.processModels.length};
  }

  public async getActiveCorrelations(
    identity: IIdentity,
    offset: number = 0,
    limit: number = 0,
  ): Promise<DataModels.Correlations.CorrelationList> {
    const result = (await this.managementApiClient.getActiveCorrelations(identity, offset, limit)) as any;

    return {correlations: result, totalCount: result.length};
  }

  public async getManualTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    const result = await this.managementApiClient.getManualTasksForProcessModel(identity, processModelId);

    return {manualTasks: result.manualTasks, totalCount: result.manualTasks.length};
  }

  public async getEmptyActivitiesForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    const result = await this.managementApiClient.getEmptyActivitiesForProcessModel(identity, processModelId);

    return {emptyActivities: result.emptyActivities, totalCount: result.emptyActivities.length};
  }

  public async getUserTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    const result = await this.managementApiClient.getUserTasksForProcessModel(identity, processModelId);

    return {userTasks: result.userTasks, totalCount: result.userTasks.length};
  }

  public async getManualTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    const result = await this.managementApiClient.getManualTasksForCorrelation(identity, correlationId);

    return {manualTasks: result.manualTasks, totalCount: result.manualTasks.length};
  }

  public async getEmptyActivitiesForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    const result = await this.managementApiClient.getEmptyActivitiesForCorrelation(identity, correlationId);

    return {emptyActivities: result.emptyActivities, totalCount: result.emptyActivities.length};
  }

  public async getUserTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    const result = await this.managementApiClient.getUserTasksForCorrelation(identity, correlationId);

    return {userTasks: result.userTasks, totalCount: result.userTasks.length};
  }

  public async getManualTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    const result = await this.managementApiClient.getManualTasksForProcessInstance(identity, correlationId);

    return {manualTasks: result.manualTasks, totalCount: result.manualTasks.length};
  }

  public async getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    const result = await this.managementApiClient.getEmptyActivitiesForProcessInstance(identity, correlationId);

    return {emptyActivities: result.emptyActivities, totalCount: result.emptyActivities.length};
  }

  public async getUserTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    const result = await this.managementApiClient.getUserTasksForProcessInstance(identity, correlationId);

    return {userTasks: result.userTasks, totalCount: result.userTasks.length};
  }

  public terminateProcessInstance(identity: IIdentity, processInstanceId: string): Promise<void> {
    return this.managementApiClient.terminateProcessInstance(identity, processInstanceId);
  }

  public onProcessEnded(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onProcessEnded(
      identity,
      (message: Messages.BpmnEvents.EndEventReachedMessage): void => {
        callback();
      },
    );
  }

  public onProcessStarted(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onProcessStarted(
      identity,
      (processStarted: Messages.SystemEvents.ProcessStartedMessage): void => {
        callback(processStarted);
      },
    );
  }

  public onProcessError(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onProcessError(
      identity,
      (processErrorMessage: Messages.SystemEvents.ProcessErrorMessage): void => {
        callback(processErrorMessage);
      },
    );
  }

  public onProcessTerminated(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onProcessTerminated(
      identity,
      (processErrorMessage: Messages.SystemEvents.ProcessErrorMessage): void => {
        callback(processErrorMessage);
      },
    );
  }

  public onEmptyActivityFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onEmptyActivityFinished(
      identity,
      (emptyActivityFinishedMessage: Messages.SystemEvents.EmptyActivityFinishedMessage): void => {
        callback(emptyActivityFinishedMessage);
      },
    );
  }

  public onEmptyActivityWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onEmptyActivityWaiting(
      identity,
      (emptyActivityReachedMessage: Messages.SystemEvents.EmptyActivityReachedMessage): void => {
        callback(emptyActivityReachedMessage);
      },
    );
  }

  public onManualTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onManualTaskFinished(
      identity,
      (manualTaskFinishedMessage: Messages.SystemEvents.ManualTaskFinishedMessage): void => {
        callback(manualTaskFinishedMessage);
      },
    );
  }

  public onManualTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onManualTaskWaiting(
      identity,
      (manualTaskReachedMessage: Messages.SystemEvents.ManualTaskReachedMessage): void => {
        callback(manualTaskReachedMessage);
      },
    );
  }

  public onUserTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onUserTaskFinished(
      identity,
      (userTaskFinishedMessage: Messages.SystemEvents.UserTaskFinishedMessage): void => {
        callback(userTaskFinishedMessage);
      },
    );
  }

  public onUserTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onUserTaskWaiting(
      identity,
      (userTaskReachedMessage: Messages.SystemEvents.UserTaskReachedMessage): void => {
        callback(userTaskReachedMessage);
      },
    );
  }

  public onCronjobCreated(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onCronjobCreated(
      identity,
      (message: Messages.SystemEvents.CronjobCreatedMessage): void => {
        callback(message);
      },
    );
  }

  public onCronjobExecuted(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onCronjobExecuted(
      identity,
      (message: Messages.SystemEvents.CronjobExecutedMessage): void => {
        callback(message);
      },
    );
  }

  public onCronjobRemoved(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onCronjobRemoved(
      identity,
      (message: Messages.SystemEvents.CronjobRemovedMessage): void => {
        callback(message);
      },
    );
  }

  public onCronjobStopped(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onCronjobStopped(
      identity,
      (message: Messages.SystemEvents.CronjobStoppedMessage): void => {
        callback(message);
      },
    );
  }

  public onCronjobUpdated(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.managementApiClient.onCronjobUpdated(
      identity,
      (message: Messages.SystemEvents.CronjobUpdatedMessage): void => {
        callback(message);
      },
    );
  }

  public finishManualTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    manualTaskInstanceId: string,
  ): Promise<void> {
    return this.managementApiClient.finishManualTask(identity, processInstanceId, correlationId, manualTaskInstanceId);
  }

  public finishUserTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    userTaskInstanceId: string,
    userTaskResult: DataModels.UserTasks.UserTaskResult,
  ): Promise<void> {
    return this.managementApiClient.finishUserTask(
      identity,
      processInstanceId,
      correlationId,
      userTaskInstanceId,
      userTaskResult,
    );
  }

  public removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void> {
    return this.managementApiClient.removeSubscription(identity, subscription);
  }

  public async getAllSuspendedTasks(identity: IIdentity, offset: number = 0, limit: number = 0): Promise<TaskList> {
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

    const taskList: TaskList = {
      taskListEntries: applyPagination(allTasks, offset, limit),
      totalCount: allTasks.length,
    };

    return taskList;
  }

  public async getSuspendedTasksForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<TaskList> {
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

    const userTasks: Array<TaskListEntry> = this.mapTasksToTaskListEntry(userTaskList.userTasks, TaskType.UserTask);
    const manualTasks: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      manualTaskList.manualTasks,
      TaskType.ManualTask,
    );
    const emptyActivities: Array<TaskListEntry> = this.mapTasksToTaskListEntry(
      emptyActivityList.emptyActivities,
      TaskType.EmptyActivity,
    );

    const taskListEntries: Array<TaskListEntry> = [].concat(userTasks, manualTasks, emptyActivities);

    const taskList: TaskList = {
      taskListEntries: applyPagination(taskListEntries, offset, limit),
      totalCount: taskListEntries.length,
    };

    return taskList;
  }

  public async getSuspendedTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<TaskList> {
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

    const taskListEntries: Array<TaskListEntry> = [].concat(userTasks, manualTasks, emptyActivities);

    const taskList: TaskList = {
      taskListEntries: applyPagination(taskListEntries, offset, limit),
      totalCount: taskListEntries.length,
    };

    return taskList;
  }

  public async getSuspendedTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset: number = 0,
    limit: number = 0,
  ): Promise<TaskList> {
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

    const taskListEntries: Array<TaskListEntry> = [].concat(userTasks, manualTasks, emptyActivities);

    const taskList: TaskList = {
      taskListEntries: applyPagination(taskListEntries, offset, limit),
      totalCount: taskListEntries.length,
    };

    return taskList;
  }

  public getCorrelationById(identity: IIdentity, correlationId: string): Promise<Correlation> {
    return this.managementApiClient.getCorrelationById(identity, correlationId);
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
