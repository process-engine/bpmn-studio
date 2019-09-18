import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {IHeatmapRepository} from '../contracts/IHeatmap.Repository';

@inject('ManagementApiClientService')
export class HeatmapRepository implements IHeatmapRepository {
  private managementApiClientService: IManagementApiClient;
  private identity: IIdentity;

  constructor(managementApiClientService: IManagementApiClient) {
    this.managementApiClientService = managementApiClientService;
  }

  public getRuntimeInformationForProcessModel(
    processModelId: string,
  ): Promise<DataModels.Kpi.FlowNodeRuntimeInformationList> {
    return this.managementApiClientService.getRuntimeInformationForProcessModel(this.identity, processModelId);
  }

  public getProcess(processModelId: string): Promise<DataModels.ProcessModels.ProcessModel> {
    return this.managementApiClientService.getProcessModelById(this.identity, processModelId);
  }

  public getActiveTokensForFlowNode(flowNodeId: string): Promise<DataModels.Kpi.ActiveTokenList> {
    return this.managementApiClientService.getActiveTokensForFlowNode(this.identity, flowNodeId);
  }

  public setIdentity(identity: IIdentity): void {
    this.identity = identity;
  }
}
