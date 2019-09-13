import {DataModels} from '@process-engine/management_api_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {DashboardRepository} from './dashboard-repository';
import {TaskListEntry} from '../contracts';

export class DashboardPaginationRepository extends DashboardRepository {
  public getAllActiveCronjobs(identity: IIdentity): Promise<DataModels.Cronjobs.CronjobList> {
    return this.managementApiService.getAllActiveCronjobs(identity);
  }

  public getProcessModels(identity: IIdentity): Promise<DataModels.ProcessModels.ProcessModelList> {
    return this.managementApiService.getProcessModels(identity);
  }

  public getActiveCorrelations(identity: IIdentity): Promise<DataModels.Correlations.CorrelationList> {
    return this.managementApiService.getActiveCorrelations(identity);
  }

  public getManualTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    return this.managementApiService.getManualTasksForProcessModel(identity, processModelId);
  }

  public getEmptyActivitiesForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    return this.managementApiService.getEmptyActivitiesForProcessModel(identity, processModelId);
  }

  public getUserTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    return this.managementApiService.getUserTasksForProcessModel(identity, processModelId);
  }

  public getManualTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    return this.managementApiService.getManualTasksForCorrelation(identity, correlationId);
  }

  public async getEmptyActivitiesForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    return this.managementApiService.getEmptyActivitiesForCorrelation(identity, correlationId);
  }

  public async getUserTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    return this.managementApiService.getUserTasksForCorrelation(identity, correlationId);
  }

  public getManualTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.ManualTasks.ManualTaskList> {
    return this.managementApiService.getManualTasksForProcessInstance(identity, correlationId);
  }

  public async getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList> {
    return this.managementApiService.getEmptyActivitiesForProcessInstance(identity, correlationId);
  }

  public getUserTasksForProcessInstance(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.UserTasks.UserTaskList> {
    return this.managementApiService.getUserTasksForProcessInstance(identity, correlationId);
  }

  public async getAllSuspendedTasks(identity: IIdentity): Promise<Array<TaskListEntry>> {
    const taskList: DataModels.Tasks.TaskList = await this.managementApiService.getAllSuspendedTasks(identity);
    const allTasks: Array<TaskListEntry> = [].concat(
      taskList.emptyActivities,
      taskList.manualTasks,
      taskList.userTasks,
    );

    return allTasks;
  }
}
