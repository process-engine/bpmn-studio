import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {EventAggregator} from 'aurelia-event-aggregator';
import {
  ProcessInstance,
  ProcessInstanceList,
} from '@process-engine/management_api_contracts/dist/data_models/correlation';
import {IInspectProcessInstanceRepository, IInspectProcessInstanceService} from '../contracts';
import {InspectProcessInstancePaginationRepository} from '../repositories/inspect-process-instance.pagination-repository';
import environment from '../../../../environment';
import {InspectProcessInstanceRepository} from '../repositories/inspect-process-instance.repository';
import {ISolutionEntry} from '../../../../contracts';
import {processEngineSupportsPagination} from '../../../../services/process-engine-version-module/process-engine-version.module';

@inject(EventAggregator, 'ManagementApiClientService')
export class InspectProcessInstanceService implements IInspectProcessInstanceService {
  private inspectProcessInstanceRepository: IInspectProcessInstanceRepository;
  private eventAggregator: EventAggregator;
  private managementApiClient: IManagementApiClient;

  constructor(eventAggregator: EventAggregator, managementApiClient: IManagementApiClient) {
    this.eventAggregator = eventAggregator;
    this.managementApiClient = managementApiClient;

    this.eventAggregator.subscribe(
      environment.events.configPanel.solutionEntryChanged,
      (solutionEntry: ISolutionEntry) => {
        if (processEngineSupportsPagination(solutionEntry.processEngineVersion)) {
          this.inspectProcessInstanceRepository = new InspectProcessInstancePaginationRepository(
            this.managementApiClient,
          );
        } else {
          this.inspectProcessInstanceRepository = new InspectProcessInstanceRepository(this.managementApiClient);
        }
      },
    );
  }

  public async getAllCorrelationsForProcessModelId(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Correlations.CorrelationList> {
    return this.inspectProcessInstanceRepository.getAllCorrelationsForProcessModelId(
      identity,
      processModelId,
      offset,
      limit,
    );
  }

  public async getCorrelationById(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.Correlations.Correlation> {
    return this.inspectProcessInstanceRepository.getCorrelationById(identity, correlationId);
  }

  public async getLogsForCorrelation(
    correlation: DataModels.Correlations.Correlation,
    identity: IIdentity,
  ): Promise<Array<DataModels.Logging.LogEntryList>> {
    return this.inspectProcessInstanceRepository.getLogsForCorrelation(correlation, identity);
  }

  public async getLogsForProcessInstance(
    processModelId: string,
    processInstanceId: string,
    identity: IIdentity,
  ): Promise<DataModels.Logging.LogEntryList> {
    return this.inspectProcessInstanceRepository.getLogsForProcessInstance(processModelId, processInstanceId, identity);
  }

  public async getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | undefined> {
    try {
      const tokenHistory: DataModels.TokenHistory.TokenHistoryGroup = {};
      const tokenForFlowNodeInstance: DataModels.TokenHistory.TokenHistoryEntryList = await this.inspectProcessInstanceRepository.getTokenForFlowNodeInstance(
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
      return await this.inspectProcessInstanceRepository.getTokenForFlowNodeByProcessInstanceId(
        processInstanceId,
        flowNodeId,
        identity,
      );
    } catch (error) {
      return undefined;
    }
  }

  public getProcessInstancesForProcessModel(
    identity: IIdentity,
    processModelId: string,
    offset?: number,
    limit?: number,
  ): Promise<ProcessInstanceList> {
    return this.inspectProcessInstanceRepository.getProcessInstancesForProcessModel(
      identity,
      processModelId,
      offset,
      limit,
    );
  }

  public getProcessInstancesForCorrelation(
    identity: IIdentity,
    correlationId: string,
    offset?: number,
    limit?: number,
  ): Promise<ProcessInstanceList> {
    return this.inspectProcessInstanceRepository.getProcessInstancesForCorrelation(
      identity,
      correlationId,
      offset,
      limit,
    );
  }

  public getProcessInstanceById(
    identity: IIdentity,
    processInstanceId: string,
    processModelId: string,
  ): Promise<ProcessInstance> {
    return this.inspectProcessInstanceRepository.getProcessInstancesById(identity, processInstanceId, processModelId);
  }
}
