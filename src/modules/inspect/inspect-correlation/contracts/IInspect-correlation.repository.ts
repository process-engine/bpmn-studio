import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

export interface IInspectCorrelationRepository {
  getAllCorrelationsForProcessModelId(
    processModelId: string,
    identity: IIdentity,
  ): Promise<DataModels.Correlations.CorrelationList>;
  getLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntryList>>;
  getLogsForProcessInstance(
    processModelId: string,
    processInstance: string,
    identity: IIdentity,
  ): Promise<DataModels.Logging.LogEntryList>;
  getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryEntryList>;
  getTokenForFlowNodeByProcessInstanceId(
    processInstanceId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup>;
  getOldAllCorrelationsForProcessModelId(
    processModelId: string,
    identity: IIdentity,
  ): Promise<Array<DataModels.Correlations.Correlation>>;
  getOldLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntry>>;
  getOldLogsForProcessInstance(
    processModelId: string,
    processInstance: string,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntry>>;
  getOldTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<Array<DataModels.TokenHistory.TokenHistoryEntry>>;
  getOldTokenForFlowNodeByProcessInstanceId(
    processInstanceId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup>;
}
