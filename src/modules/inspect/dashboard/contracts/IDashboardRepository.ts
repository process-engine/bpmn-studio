import {DataModels} from '@process-engine/management_api_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {TaskListEntry} from './index';

export interface IDashboardRepository {
  getAllSuspendedTasks(identity: IIdentity): Promise<Array<TaskListEntry>>;
  getAllActiveCronjobs(identity: IIdentity, offset?: number, limit?: number): Promise<DataModels.Cronjobs.CronjobList>;
  getActiveCorrelations(
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Correlations.CorrelationList>;
  getProcessModels(
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.ProcessModels.ProcessModelList>;
  getManualTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.ManualTasks.ManualTaskList>;
  getEmptyActivitiesForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList>;
  getUserTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.UserTasks.UserTaskList>;
  getManualTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.ManualTasks.ManualTaskList>;
  getEmptyActivitiesForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList>;
  getUserTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.UserTasks.UserTaskList>;
  getManualTasksForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.ManualTasks.ManualTaskList>;
  getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList>;
  getUserTasksForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.UserTasks.UserTaskList>;
  terminateProcessInstance(identity: IIdentity, processInstanceId: string): Promise<void>;
  finishManualTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    manualTaskInstanceId: string,
  ): Promise<void>;
  finishUserTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    userTaskInstanceId: string,
    userTaskResult: DataModels.UserTasks.UserTaskResult,
  ): Promise<void>;
  onProcessEnded(identity: IIdentity, callback: Function): Promise<Subscription>;
  onProcessStarted(identity: IIdentity, callback: Function): Promise<Subscription>;
  onProcessError(identity: IIdentity, callback: Function): Promise<Subscription>;
  onEmptyActivityFinished(identity: IIdentity, callback: Function): Promise<Subscription>;
  onEmptyActivityWaiting(identity: IIdentity, callback: Function): Promise<Subscription>;
  onUserTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription>;
  onUserTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription>;
  onManualTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription>;
  onManualTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription>;
  removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void>;
}
