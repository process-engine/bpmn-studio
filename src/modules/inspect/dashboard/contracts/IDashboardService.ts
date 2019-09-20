import {IIdentity} from '@essential-projects/iam_contracts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {TaskListEntry} from './index';

export interface IDashboardService {
  getAllSuspendedTasks(identity: IIdentity): Promise<Array<TaskListEntry>>;
  getAllActiveCronjobs(identity: IIdentity): Promise<DataModels.Cronjobs.CronjobList>;
  getProcessModels(identity: IIdentity): Promise<DataModels.ProcessModels.ProcessModelList>;
  getActiveCorrelations(identity: IIdentity): Promise<DataModels.Correlations.CorrelationList>;
  getManualTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList>;
  getEmptyActivitiesForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList>;
  getUserTasksForProcessModel(identity: IIdentity, processModelId: string): Promise<DataModels.UserTasks.UserTaskList>;
  getManualTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList>;
  getEmptyActivitiesForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList>;
  getUserTasksForCorrelation(identity: IIdentity, correlationId: string): Promise<DataModels.UserTasks.UserTaskList>;
  getManualTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList>;
  getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList>;
  getUserTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList>;
  terminateProcessInstance(identity: IIdentity, processInstanceId: string): Promise<void>;
  onProcessEnded(identity: IIdentity, callback: Function): Promise<Subscription>;
  onProcessStarted(identity: IIdentity, callback: Function): Promise<Subscription>;
  onProcessError(identity: IIdentity, callback: Function): Promise<Subscription>;
  onEmptyActivityFinished(identity: IIdentity, callback: Function): Promise<Subscription>;
  onEmptyActivityWaiting(identity: IIdentity, callback: Function): Promise<Subscription>;
  onUserTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription>;
  onUserTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription>;
  onManualTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription>;
  onManualTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription>;
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
  removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void>;
}
