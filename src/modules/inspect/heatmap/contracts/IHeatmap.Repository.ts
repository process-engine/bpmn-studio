import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

export interface IHeatmapRepository {
  getRuntimeInformationForProcessModel(processModelId: string): Promise<DataModels.Kpi.FlowNodeRuntimeInformationList>;
  getProcess(processModelId: string): Promise<DataModels.ProcessModels.ProcessModel>;
  getActiveTokensForFlowNode(flowNodeId: string): Promise<DataModels.Kpi.ActiveTokenList>;
  setIdentity(identity: IIdentity): void;
}
