import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {
  ProcessInstance,
  ProcessInstanceList,
} from '@process-engine/management_api_contracts/dist/data_models/correlation';
import {IInspectProcessInstanceRepository} from '../contracts';
import {applyPagination} from '../../../../services/pagination-module/pagination.module';

export class InspectProcessInstanceRepository implements IInspectProcessInstanceRepository {
  protected managementApiClient: IManagementApiClient;

  constructor(managementApiClient: IManagementApiClient) {
    this.managementApiClient = managementApiClient;
  }

  public async getAllCorrelationsForProcessModelId(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Correlations.CorrelationList> {
    const result: Array<DataModels.Correlations.Correlation> = (await this.managementApiClient.getCorrelationsByProcessModelId(
      identity,
      processModelId,
    )) as any;

    const paginizedCorrelations = applyPagination(result, offset, limit);

    return {correlations: paginizedCorrelations, totalCount: result.length};
  }

  public async getLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntryList>> {
    const logsForAllProcessModelsOfCorrelation: Array<DataModels.Logging.LogEntry> = [];

    for (const processModel of correlation.processInstances) {
      const logsForProcessModel: DataModels.Logging.LogEntry = (await this.managementApiClient.getProcessModelLog(
        identity,
        processModel.processModelId,
        correlation.id,
      )) as any;

      logsForAllProcessModelsOfCorrelation.push(logsForProcessModel);
    }

    const logsForCorrelation: Array<DataModels.Logging.LogEntry> = [].concat(...logsForAllProcessModelsOfCorrelation);

    return [{logEntries: logsForCorrelation, totalCount: logsForCorrelation.length}];
  }

  public async getLogsForProcessInstance(
    processModelId: string,
    processInstanceId: string,
    identity: IIdentity,
  ): Promise<DataModels.Logging.LogEntryList> {
    const logs: Array<DataModels.Logging.LogEntry> = (await this.managementApiClient.getProcessInstanceLog(
      identity,
      processModelId,
      processInstanceId,
    )) as any;

    return {logEntries: logs, totalCount: logs.length};
  }

  public async getCorrelationById(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.Correlations.Correlation> {
    return this.managementApiClient.getCorrelationById(identity, correlationId);
  }

  public async getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryEntryList> {
    const result: Array<DataModels.TokenHistory.TokenHistoryEntry> = (await this.managementApiClient.getTokensForFlowNode(
      identity,
      correlationId,
      processModelId,
      flowNodeId,
    )) as any;

    return {tokenHistoryEntries: result, totalCount: result.length};
  }

  public async getTokenForFlowNodeByProcessInstanceId(
    processInstanceId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup> {
    return this.managementApiClient.getTokensForFlowNodeByProcessInstanceId(identity, processInstanceId, flowNodeId);
  }

  public async getProcessInstancesForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<ProcessInstanceList> {
    const processInstances = await this.getMappedProcessInstancesByProcessModelId(identity, processModelId);

    const paginizedProcessInstances = applyPagination(processInstances, offset, limit);

    return {processInstances: paginizedProcessInstances, totalCount: processInstances.length};
  }

  public async getProcessInstancesForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<ProcessInstanceList> {
    const processInstances: Array<DataModels.Correlations.ProcessInstance> = (await this.managementApiClient.getProcessInstancesForCorrelation(
      identity,
      correlationId,
    )) as any;

    const paginizedProcessInstances = applyPagination(processInstances, offset, limit);

    return {processInstances: paginizedProcessInstances, totalCount: processInstances.length};
  }

  public async getProcessInstancesById(
    identity: IIdentity,
    processInstanceId: string,
    processModelId: string,
  ): Promise<ProcessInstance> {
    const processInstances = await this.getMappedProcessInstancesByProcessModelId(identity, processModelId);

    const processInstance = processInstances.find((instance: DataModels.Correlations.ProcessInstance) => {
      return instance.processInstanceId === processInstanceId;
    });

    return processInstance;
  }

  private async getMappedProcessInstancesByProcessModelId(
    identity: IIdentity,
    processModelId: string,
  ): Promise<Array<ProcessInstance>> {
    const result: Array<DataModels.Correlations.Correlation> = (await this.managementApiClient.getCorrelationsByProcessModelId(
      identity,
      processModelId,
    )) as any;

    const processInstances: Array<ProcessInstance> = [];

    result.forEach((correlation: DataModels.Correlations.Correlation) => {
      const processInstancesForCorrelation = correlation.processInstances.map(
        (instance: DataModels.Correlations.ProcessInstance) => {
          instance.correlationId = correlation.id;

          return instance;
        },
      );

      processInstances.push(...processInstancesForCorrelation);
    });

    return processInstances;
  }
}
