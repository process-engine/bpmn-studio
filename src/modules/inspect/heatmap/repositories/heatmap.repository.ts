import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {IHeatmapRepository} from '../contracts/IHeatmapRepository';

export class HeatmapRepository implements IHeatmapRepository {
  protected managementApiClientService: IManagementApiClient;

  constructor(managementApiClientService: IManagementApiClient) {
    this.managementApiClientService = managementApiClientService;
  }

  public async getRuntimeInformationForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.Kpi.FlowNodeRuntimeInformationList> {
    const result = (await this.managementApiClientService.getRuntimeInformationForProcessModel(
      identity,
      processModelId,
    )) as any;

    return {flowNodeRuntimeInformation: result, totalCount: result.length};
  }

  public getProcess(identity: IIdentity, processModelId: string): Promise<DataModels.ProcessModels.ProcessModel> {
    return this.managementApiClientService.getProcessModelById(identity, processModelId);
  }

  public async getActiveTokensForFlowNode(
    identity: IIdentity,
    flowNodeId: string,
  ): Promise<DataModels.Kpi.ActiveTokenList> {
    const result = (await this.managementApiClientService.getActiveTokensForFlowNode(identity, flowNodeId)) as any;

    return {activeTokens: result, totalCount: result.length};
  }
}
