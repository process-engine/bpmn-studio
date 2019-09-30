import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {
  ProcessInstance,
  ProcessInstanceList,
} from '@process-engine/management_api_contracts/dist/data_models/correlation';
import {IInspectCorrelationRepository} from '../contracts';

export class InspectCorrelationRepository implements IInspectCorrelationRepository {
  protected managementApiService: IManagementApiClient;

  constructor(managementApi: IManagementApiClient) {
    this.managementApiService = managementApi;
  }

  public async getAllCorrelationsForProcessModelId(
    processModelId: string,
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Correlations.CorrelationList> {
    const result = ((await this.managementApiService.getCorrelationsByProcessModelId(
      identity,
      processModelId,
    )) as unknown) as Array<DataModels.Correlations.Correlation>;

    const paginizedCorrelations = this.applyPagination(result, offset, limit);

    return {correlations: paginizedCorrelations, totalCount: result.length};
  }

  public async getLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntryList>> {
    const logsForAllProcessModelsOfCorrelation: Array<DataModels.Logging.LogEntry> = [];

    for (const processModel of correlation.processInstances) {
      const logsForProcessModel: DataModels.Logging.LogEntry = (await this.managementApiService.getProcessModelLog(
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
    const logs: Array<DataModels.Logging.LogEntry> = (await this.managementApiService.getProcessInstanceLog(
      identity,
      processModelId,
      processInstanceId,
    )) as any;

    return {logEntries: logs, totalCount: logs.length};
  }

  public async getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryEntryList> {
    const result: Array<
      DataModels.TokenHistory.TokenHistoryEntry
    > = (await this.managementApiService.getTokensForFlowNode(
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
    return this.managementApiService.getTokensForFlowNodeByProcessInstanceId(identity, processInstanceId, flowNodeId);
  }

  public async getProcessInstancesForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<ProcessInstanceList> {
    const result = ((await this.managementApiService.getCorrelationsByProcessModelId(
      identity,
      processModelId,
    )) as unknown) as Array<DataModels.Correlations.Correlation>;

    const processInstances: Array<ProcessInstance> = [];

    result.forEach((correlation: DataModels.Correlations.Correlation) => {
      processInstances.push(
        ...correlation.processInstances.map((instance: DataModels.Correlations.ProcessInstance) => {
          instance.correlationId = correlation.id;

          return instance;
        }),
      );
    });

    const paginizedProcessInstances = this.applyPagination(processInstances, offset, limit);

    return {processInstances: paginizedProcessInstances, totalCount: processInstances.length};
  }

  public applyPagination<TList>(list: Array<TList>, offset: number, limit: number): Array<TList> {
    const paginatedList: Array<TList> = list.slice();

    if (offset > 0) {
      paginatedList.splice(0, offset);
    }

    if (limit > 0) {
      paginatedList.splice(limit, paginatedList.length - limit);
    }

    return paginatedList;
  }
}
