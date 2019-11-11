import {DataModels} from '@process-engine/management_api_contracts';

import {IIdentity} from '@essential-projects/iam_contracts';
import {IHeatmapRepository} from '../contracts/IHeatmapRepository';
import {HeatmapRepository} from './heatmap.repository';

export class HeatmapPaginationRepository extends HeatmapRepository implements IHeatmapRepository {
  public getRuntimeInformationForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.Kpi.FlowNodeRuntimeInformationList> {
    return this.managementApiClientService.getRuntimeInformationForProcessModel(identity, processModelId);
  }

  public getActiveTokensForFlowNode(identity: IIdentity, flowNodeId: string): Promise<DataModels.Kpi.ActiveTokenList> {
    return this.managementApiClientService.getActiveTokensForFlowNode(identity, flowNodeId);
  }
}
