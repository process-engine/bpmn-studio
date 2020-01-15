import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';
import {
  ProcessInstance,
  ProcessInstanceList,
} from '@process-engine/management_api_contracts/dist/data_models/correlation';

export interface IInspectProcessInstanceService {
  getAllCorrelationsForProcessModelId(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Correlations.CorrelationList>;
  getCorrelationById(identity: IIdentity, correlationId: string): Promise<DataModels.Correlations.Correlation>;
  getLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<Array<DataModels.Logging.LogEntryList>>;
  getLogsForProcessInstance(
    processModelId: string,
    processInstance: string,
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Logging.LogEntryList>;
  getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | undefined>;
  getTokenForFlowNodeByProcessInstanceId(
    processInstanceId: string,
    flowNodeId: string,
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | undefined>;
  getProcessInstancesForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<ProcessInstanceList>;
  getProcessInstanceById(
    identity: IIdentity,
    processInstanceId: string,
    processModelId?: string,
  ): Promise<ProcessInstance>;
  getProcessInstancesForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<ProcessInstanceList>;
}
