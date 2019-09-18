import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';
import {ManagementApiClient} from '@process-engine/management_api_client';
import {DataModels} from '@process-engine/management_api_contracts';

import {IDynamicUiService} from '../../contracts';

@inject('ManagementApiClientService')
export class DynamicUiService implements IDynamicUiService {
  private managementApiClient: ManagementApiClient;

  constructor(managmentApiClient: ManagementApiClient) {
    this.managementApiClient = managmentApiClient;
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

  public async getUserTask(
    identity: IIdentity,
    processInstanceId: string,
    userTaskId: string,
  ): Promise<DataModels.UserTasks.UserTask> {
    const userTaskList: DataModels.UserTasks.UserTaskList = await this.managementApiClient.getUserTasksForProcessInstance(
      identity,
      processInstanceId,
    );

    return userTaskList.userTasks.find((userTask: DataModels.UserTasks.UserTask) => {
      return userTask.id === userTaskId;
    });
  }

  public finishManualTask(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    manualTaskInstanceId: string,
  ): Promise<void> {
    return this.managementApiClient.finishManualTask(identity, processInstanceId, correlationId, manualTaskInstanceId);
  }

  public async getManualTask(
    identity: IIdentity,
    processInstanceId: string,
    manualTaskId: string,
  ): Promise<DataModels.ManualTasks.ManualTask> {
    const manualTaskList: DataModels.ManualTasks.ManualTaskList = await this.managementApiClient.getManualTasksForProcessInstance(
      identity,
      processInstanceId,
    );

    return manualTaskList.manualTasks.find((manualTask: DataModels.ManualTasks.ManualTask) => {
      return manualTask.id === manualTaskId;
    });
  }
}
