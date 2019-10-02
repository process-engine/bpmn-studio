import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

export interface IHeatmapRepository {
  getRuntimeInformationForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.Kpi.FlowNodeRuntimeInformationList>;
  getProcess(identity: IIdentity, processModelId: string): Promise<DataModels.ProcessModels.ProcessModel>;
  getActiveTokensForFlowNode(identity: IIdentity, flowNodeId: string): Promise<DataModels.Kpi.ActiveTokenList>;
}
