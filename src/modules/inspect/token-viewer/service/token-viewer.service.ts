import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';
import {ManagementApiClient} from '@process-engine/management_api_client';

import environment from '../../../../environment';

import {ITokenViewerRepository, ITokenViewerService} from '../contracts';
import {ISolutionEntry} from '../../../../contracts';

import {createTokenViewerRepository} from '../repository/token-viewer-repository-factory';

@inject(EventAggregator, ManagementApiClient)
export class TokenViewerService implements ITokenViewerService {
  private tokenViewerRepository: ITokenViewerRepository;

  constructor(eventAggregator: EventAggregator, managementApiClient: IManagementApiClient) {
    eventAggregator.subscribe(environment.events.configPanel.solutionEntryChanged, (solutionEntry: ISolutionEntry) => {
      this.tokenViewerRepository = createTokenViewerRepository(managementApiClient, solutionEntry.processEngineVersion);
    });
  }

  public async getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | undefined> {
    try {
      const tokenHistory: DataModels.TokenHistory.TokenHistoryGroup = {};
      const tokenForFlowNodeInstance: DataModels.TokenHistory.TokenHistoryEntryList = await this.tokenViewerRepository.getTokenForFlowNodeInstance(
        processModelId,
        correlationId,
        flowNodeId,
        identity,
      );

      tokenHistory[tokenForFlowNodeInstance.tokenHistoryEntries[0].flowNodeId] = tokenForFlowNodeInstance;
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
      return await this.tokenViewerRepository.getTokenForFlowNodeByProcessInstanceId(
        processInstanceId,
        flowNodeId,
        identity,
      );
    } catch (error) {
      return undefined;
    }
  }
}
