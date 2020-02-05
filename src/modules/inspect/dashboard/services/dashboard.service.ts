import {inject} from 'aurelia-framework';

import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {EventAggregator} from 'aurelia-event-aggregator';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {Correlation} from '@process-engine/management_api_contracts/dist/data_models/correlation';
import environment from '../../../../environment';
import {ISolutionEntry} from '../../../../contracts';
import {IDashboardRepository} from '../contracts/IDashboardRepository';
import {IDashboardService, TaskList} from '../contracts/index';
import {createDashboardRepository} from '../repositories/dashboard-repository-factory';

@inject(EventAggregator, 'ManagementApiClientService')
export class DashboardService implements IDashboardService {
  public eventAggregator: EventAggregator;

  private dashboardRepository: IDashboardRepository;
  private managementApiClient: IManagementApiClient;

  private activeSolutionEntry: ISolutionEntry;

  constructor(eventAggregator: EventAggregator, managementApiClient: IManagementApiClient) {
    this.eventAggregator = eventAggregator;
    this.managementApiClient = managementApiClient;

    this.eventAggregator.subscribe(
      environment.events.configPanel.solutionEntryChanged,
      (solutionEntry: ISolutionEntry) => {
        if (this.activeSolutionEntry !== solutionEntry) {
          this.dashboardRepository = createDashboardRepository(managementApiClient, solutionEntry.processEngineVersion);
          this.activeSolutionEntry = solutionEntry;
        }
      },
    );
  }

  public getAllSuspendedTasks(identity: IIdentity, offset?: number, limit?: number): Promise<TaskList> {
    return this.dashboardRepository.getAllSuspendedTasks(identity, offset, limit);
  }

  public getAllActiveProcessInstances(
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Correlations.ProcessInstanceList> {
    return this.dashboardRepository.getAllActiveProcessInstances(identity, offset, limit);
  }

  public async getSuspendedTasksForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset?: number,
    limit?: number,
  ): Promise<TaskList> {
    return this.dashboardRepository.getSuspendedTasksForProcessInstance(identity, processInstanceId, offset, limit);
  }

  public async getSuspendedTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<TaskList> {
    return this.dashboardRepository.getSuspendedTasksForCorrelation(identity, correlationId, offset, limit);
  }

  public async getSuspendedTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<TaskList> {
    return this.dashboardRepository.getSuspendedTasksForProcessModel(identity, processModelId, offset, limit);
  }

  public getAllActiveCronjobs(
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Cronjobs.CronjobList> {
    return this.dashboardRepository.getAllActiveCronjobs(identity, offset, limit);
  }

  public getProcessModels(identity: IIdentity): Promise<DataModels.ProcessModels.ProcessModelList> {
    return this.dashboardRepository.getProcessModels(identity);
  }

  public getActiveCorrelations(identity: IIdentity): Promise<DataModels.Correlations.CorrelationList> {
    return this.dashboardRepository.getActiveCorrelations(identity);
  }

  public getManualTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    return this.dashboardRepository.getManualTasksForProcessModel(identity, processModelId);
  }

  public getEmptyActivitiesForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    return this.dashboardRepository.getEmptyActivitiesForProcessModel(identity, processModelId);
  }

  public getUserTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    return this.dashboardRepository.getUserTasksForProcessModel(identity, processModelId);
  }

  public getManualTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    return this.dashboardRepository.getManualTasksForCorrelation(identity, correlationId);
  }

  public async getEmptyActivitiesForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    return this.dashboardRepository.getEmptyActivitiesForCorrelation(identity, correlationId);
  }

  public async getUserTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    return this.dashboardRepository.getUserTasksForCorrelation(identity, correlationId);
  }

  public getManualTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    return this.dashboardRepository.getManualTasksForProcessInstance(identity, correlationId);
  }

  public async getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    return this.dashboardRepository.getEmptyActivitiesForProcessInstance(identity, correlationId);
  }

  public getUserTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    return this.dashboardRepository.getUserTasksForProcessInstance(identity, correlationId);
  }

  public terminateProcessInstance(identity: IIdentity, processInstanceId: string): Promise<void> {
    return this.dashboardRepository.terminateProcessInstance(identity, processInstanceId);
  }

  public onProcessEnded(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onProcessEnded(identity, callback);
  }

  public onProcessStarted(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onProcessStarted(identity, callback);
  }

  public onProcessError(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onProcessError(identity, callback);
  }

  public onProcessTerminated(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onProcessTerminated(identity, callback);
  }

  public onEmptyActivityFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onEmptyActivityFinished(identity, callback);
  }

  public onEmptyActivityWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onEmptyActivityWaiting(identity, callback);
  }

  public onUserTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onUserTaskFinished(identity, callback);
  }

  public onUserTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onUserTaskWaiting(identity, callback);
  }

  public onManualTaskFinished(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onManualTaskFinished(identity, callback);
  }

  public onManualTaskWaiting(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onManualTaskWaiting(identity, callback);
  }

  public finishManualTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    manualTaskInstanceId: string,
  ): Promise<void> {
    return this.dashboardRepository.finishManualTask(identity, processInstanceId, correlationId, manualTaskInstanceId);
  }

  public finishUserTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    userTaskInstanceId: string,
    userTaskResult: DataModels.UserTasks.UserTaskResult,
  ): Promise<void> {
    return this.dashboardRepository.finishUserTask(
      identity,
      processInstanceId,
      correlationId,
      userTaskInstanceId,
      userTaskResult,
    );
  }

  public finishEmptyActivity(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    emptyActivityInstanceId: string,
  ): Promise<void> {
    return this.dashboardRepository.finishEmptyActivity(
      identity,
      processInstanceId,
      correlationId,
      emptyActivityInstanceId,
    );
  }

  public removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void> {
    return this.dashboardRepository.removeSubscription(identity, subscription);
  }

  public onCronjobCreated(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onCronjobCreated(identity, callback);
  }

  public onCronjobUpdated(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onCronjobUpdated(identity, callback);
  }

  public onCronjobStopped(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onCronjobStopped(identity, callback);
  }

  public onCronjobRemoved(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onCronjobRemoved(identity, callback);
  }

  public onCronjobExecuted(identity: IIdentity, callback: Function): Promise<Subscription> {
    return this.dashboardRepository.onCronjobExecuted(identity, callback);
  }

  public getCorrelationById(identity: IIdentity, correlationId: string): Promise<Correlation> {
    return this.dashboardRepository.getCorrelationById(identity, correlationId);
  }
}
