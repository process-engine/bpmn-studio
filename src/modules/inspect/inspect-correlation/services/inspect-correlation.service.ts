import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {EventAggregator} from 'aurelia-event-aggregator';
import {IInspectCorrelationRepository, IInspectCorrelationService} from '../contracts';
import {InspectCorrelationPaginationRepository} from '../repositories/inspect-correlation.pagination.repository';
import environment from '../../../../environment';
import {InspectCorrelationRepository} from '../repositories/inspect-correlation.repository';
import {ISolutionEntry} from '../../../../contracts';
import {supportsPaginationAndNewDataModels} from '../../../../services/process-engine-version-module/process-engine-version-module';

@inject(EventAggregator, 'ManagementApiClientService')
export class InspectCorrelationService implements IInspectCorrelationService {
  private inspectCorrelationRepository: IInspectCorrelationRepository;
  private eventAggregator: EventAggregator;
  private managementApiService: IManagementApiClient;

  constructor(eventAggregator: EventAggregator, managementApiService: IManagementApiClient) {
    this.eventAggregator = eventAggregator;
    this.managementApiService = managementApiService;

    this.eventAggregator.subscribe(
      environment.events.configPanel.solutionEntryChanged,
      (solutionEntry: ISolutionEntry) => {
        if (supportsPaginationAndNewDataModels(solutionEntry)) {
          this.inspectCorrelationRepository = new InspectCorrelationPaginationRepository(this.managementApiService);
        } else {
          this.inspectCorrelationRepository = new InspectCorrelationRepository(this.managementApiService);
        }

      },
    );
  }

  public async getAllCorrelationsForProcessModelId(
    processModelId: string,
    identity: IIdentity,
  ): Promise<DataModels.Correlations.CorrelationList> {
    return this.inspectCorrelationRepository.getAllCorrelationsForProcessModelId(processModelId, identity);
  }

  public async getLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntryList>> {
    return this.inspectCorrelationRepository.getLogsForCorrelation(correlation, identity);
  }

  public async getLogsForProcessInstance(
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
