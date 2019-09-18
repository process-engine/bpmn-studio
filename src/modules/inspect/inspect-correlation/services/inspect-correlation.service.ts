import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {IInspectCorrelationRepository, IInspectCorrelationService} from '../contracts';
import {ProcessEngineVersionService} from '../../../../services/process-engine-version-service/process-engine-version-service';

@inject('InspectCorrelationRepository', 'ProcessEngineVersionService')
export class InspectCorrelationService implements IInspectCorrelationService {
  private inspectCorrelationRepository: IInspectCorrelationRepository;
  private processEngineVersionService: ProcessEngineVersionService;

  constructor(
    inspectCorrelationRepository: IInspectCorrelationRepository,
    processEngineVersionService: ProcessEngineVersionService,
  ) {
    this.inspectCorrelationRepository = inspectCorrelationRepository;
    this.processEngineVersionService = processEngineVersionService;
  }

  public async getAllCorrelationsForProcessModelId(
    processModelId: string,
    identity: IIdentity,
  ): Promise<DataModels.Correlations.CorrelationList> {
    const supportsPaginationAndNewDataModels: boolean = this.processEngineVersionService.supportsPaginationAndNewDataModels();
    console.log(supportsPaginationAndNewDataModels);

    if (supportsPaginationAndNewDataModels) {
      return this.inspectCorrelationRepository.getAllCorrelationsForProcessModelId(processModelId, identity);
    }

    const result = await this.inspectCorrelationRepository.getOldAllCorrelationsForProcessModelId(
      processModelId,
      identity,
    );
    return {correlations: result, totalCount: result.length};
  }

  public async getLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntryList>> {
    const supportsPaginationAndNewDataModels: boolean = this.processEngineVersionService.supportsPaginationAndNewDataModels();
    if (supportsPaginationAndNewDataModels) {
      return this.inspectCorrelationRepository.getLogsForCorrelation(correlation, identity);
    }

    const result = await this.inspectCorrelationRepository.getOldLogsForCorrelation(correlation, identity);

    return [{logEntries: result, totalCount: result.length}];
  }

  public async getLogsForProcessInstance(
    processModelId: string,
    processInstanceId: string,
    identity: IIdentity,
  ): Promise<DataModels.Logging.LogEntryList> {
    const supportsPaginationAndNewDataModels: boolean = this.processEngineVersionService.supportsPaginationAndNewDataModels();
    if (supportsPaginationAndNewDataModels) {
      return this.inspectCorrelationRepository.getLogsForProcessInstance(processModelId, processInstanceId, identity);
    }

    const result = await this.inspectCorrelationRepository.getOldLogsForProcessInstance(
      processModelId,
      processInstanceId,
      identity,
    );

    return {logEntries: result, totalCount: result.length};
  }

  public async getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | undefined> {
    try {
      const supportsPaginationAndNewDataModels: boolean = this.processEngineVersionService.supportsPaginationAndNewDataModels();

      if (supportsPaginationAndNewDataModels) {
        const tokenHistory: DataModels.TokenHistory.TokenHistoryGroup = {};
        const tokenForFlowNodeInstance: DataModels.TokenHistory.TokenHistoryEntryList = await this.inspectCorrelationRepository.getTokenForFlowNodeInstance(
          processModelId,
          correlationId,
          flowNodeId,
          identity,
        );

        tokenHistory[tokenForFlowNodeInstance[0].flowNodeId] = tokenForFlowNodeInstance;
        return tokenHistory;
      }

      const tokenHistory: DataModels.TokenHistory.TokenHistoryGroup = {};
      const tokenForFlowNodeInstance: Array<
        DataModels.TokenHistory.TokenHistoryEntry
      > = await this.inspectCorrelationRepository.getOldTokenForFlowNodeInstance(
        processModelId,
        correlationId,
        flowNodeId,
        identity,
      );

      tokenHistory[tokenForFlowNodeInstance[0].flowNodeId] = {
        tokenHistoryEntries: tokenForFlowNodeInstance,
        totalCount: tokenForFlowNodeInstance.length,
      };
      return tokenHistory;
    } catch (error) {
      return undefined;
    }
  }

  public async getTokenForFlowNodeByProcessInstanceId(
    processInstanceId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | undefined> {
    try {
      const supportsPaginationAndNewDataModels: boolean = this.processEngineVersionService.supportsPaginationAndNewDataModels();

      if (supportsPaginationAndNewDataModels) {
        return await this.inspectCorrelationRepository.getTokenForFlowNodeByProcessInstanceId(
          processInstanceId,
          flowNodeId,
          identity,
        );
      }

      return await this.inspectCorrelationRepository.getOldTokenForFlowNodeByProcessInstanceId(
        processInstanceId,
        flowNodeId,
        identity,
      );
    } catch (error) {
      return undefined;
    }
  }
}
