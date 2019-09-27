import {DataModels} from '@process-engine/management_api_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';

import {DashboardRepository} from './dashboard-repository';
import {IDashboardRepository, TaskList, TaskListEntry, TaskType} from '../contracts/index';

export class DashboardPaginationRepository extends DashboardRepository implements IDashboardRepository {
  public getAllActiveCronjobs(
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Cronjobs.CronjobList> {
    return this.managementApiService.getAllActiveCronjobs(identity, offset, limit);
  }

  public getProcessModels(identity: IIdentity): Promise<DataModels.ProcessModels.ProcessModelList> {
    return this.managementApiService.getProcessModels(identity);
  }

  public getActiveCorrelations(
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Correlations.CorrelationList> {
    return this.managementApiService.getActiveCorrelations(identity, offset, limit);
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

  public async getAllSuspendedTasks(identity: IIdentity, offset?: number, limit?: number): Promise<TaskList> {
    const tasks: DataModels.FlowNodeInstances.TaskList = await this.managementApiService.getAllSuspendedTasks(
      identity,
      offset,
      limit,
    );

    const taskListEntries: Array<TaskListEntry> = this.mapTaskListToTaskListEntry(tasks);

    const taskList: TaskList = {
      taskListEntries: taskListEntries,
      totalCount: tasks.totalCount,
    };

    return taskList;
  }

  public async getSuspendedTasksForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
    offset?: number,
    limit?: number,
  ): Promise<TaskList> {
    const tasks: DataModels.FlowNodeInstances.TaskList = await this.managementApiService.getSuspendedTasksForProcessInstance(
      identity,
      processInstanceId,
      offset,
      limit,
    );

    const taskListEntries: Array<TaskListEntry> = this.mapTaskListToTaskListEntry(tasks);

    const taskList: TaskList = {
      taskListEntries: taskListEntries,
      totalCount: tasks.totalCount,
    };

    return taskList;
  }

  public async getSuspendedTasksForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<TaskList> {
    const tasks: DataModels.FlowNodeInstances.TaskList = await this.managementApiService.getSuspendedTasksForCorrelation(
      identity,
      correlationId,
      offset,
      limit,
    );

    const taskListEntries: Array<TaskListEntry> = this.mapTaskListToTaskListEntry(tasks);

    const taskList: TaskList = {
      taskListEntries: taskListEntries,
      totalCount: tasks.totalCount,
    };

    return taskList;
  }

  public async getSuspendedTasksForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<TaskList> {
    const tasks: DataModels.FlowNodeInstances.TaskList = await this.managementApiService.getSuspendedTasksForProcessModel(
      identity,
      processModelId,
      offset,
      limit,
    );

    const taskListEntries: Array<TaskListEntry> = this.mapTaskListToTaskListEntry(tasks);

    const taskList: TaskList = {
      taskListEntries: taskListEntries,
      totalCount: tasks.totalCount,
    };

    return taskList;
  }

  private mapTaskListToTaskListEntry(taskList: DataModels.FlowNodeInstances.TaskList): Array<TaskListEntry> {
    const taskListEntries: Array<TaskListEntry> = taskList.tasks.map((task) => {
      return {
        correlationId: task.correlationId,
        id: task.id,
        flowNodeInstanceId: task.flowNodeInstanceId,
        processInstanceId: task.processInstanceId,
        processModelId: task.processModelId,
        name: task.name,
        taskType: this.getTaskTypeByFlowNodeType(task.flowNodeType),
      };
    });

    return taskListEntries;
  }

  private getTaskTypeByFlowNodeType(flowNodeType: string): TaskType {
    const isUserTask: boolean = flowNodeType === 'bpmn:UserTask';
    const isManualTask: boolean = flowNodeType === 'bpmn:ManualTask';
    const isEmptyActivity: boolean = flowNodeType === 'bpmn:Task';

    if (isUserTask) {
      return TaskType.UserTask;
    }
    if (isManualTask) {
      return TaskType.ManualTask;
    }
    if (isEmptyActivity) {
      return TaskType.EmptyActivity;
    }

    return undefined;
  }
}
