import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {IInspectCorrelationRepository, IInspectCorrelationService} from '../contracts';

@inject('InspectCorrelationRepository')
export class InspectCorrelationService implements IInspectCorrelationService {
  private inspectCorrelationRepository: IInspectCorrelationRepository;

  constructor(inspectCorrelationRepository: IInspectCorrelationRepository) {
    this.inspectCorrelationRepository = inspectCorrelationRepository;
  }

  public getAllCorrelationsForProcessModelId(
    processModelId: string,
    identity: IIdentity,
  ): Promise<DataModels.Correlations.CorrelationList> {
    return this.inspectCorrelationRepository.getAllCorrelationsForProcessModelId(processModelId, identity);
  }

  public getLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntryList>> {
    return this.inspectCorrelationRepository.getLogsForCorrelation(correlation, identity);
  }

  public getLogsForProcessInstance(
    processModelId: string,
    processInstanceId: string,
    identity: IIdentity,
  ): Promise<DataModels.Logging.LogEntryList> {
    return this.inspectCorrelationRepository.getLogsForProcessInstance(processModelId, processInstanceId, identity);
  }

  public async getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | undefined> {
    try {
      const tokenHistory: DataModels.TokenHistory.TokenHistoryGroup = {};
      const tokenForFlowNodeInstance: DataModels.TokenHistory.TokenHistoryEntryList = await this.inspectCorrelationRepository.getTokenForFlowNodeInstance(
        processModelId,
        correlationId,
        flowNodeId,
        identity,
      );

      tokenHistory[tokenForFlowNodeInstance[0].flowNodeId] = tokenForFlowNodeInstance;
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
      return await this.inspectCorrelationRepository.getTokenForFlowNodeByProcessInstanceId(
        processInstanceId,
        flowNodeId,
        identity,
      );
    } catch (error) {
      return undefined;
    }
  }
}
