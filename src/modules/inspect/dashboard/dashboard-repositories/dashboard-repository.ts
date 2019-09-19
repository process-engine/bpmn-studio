import {DataModels, IManagementApiClient, Messages} from '@process-engine/management_api_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IDashboardRepository} from './IDashboardRepository';

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
}
