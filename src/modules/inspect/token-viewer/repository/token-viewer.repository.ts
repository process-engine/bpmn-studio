import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {ITokenViewerRepository} from '../contracts';

@inject('ManagementApiClientService')
export class TokenViewerRepository implements ITokenViewerRepository {
  protected managementApiClient: IManagementApiClient;

  constructor(managementApiClient: IManagementApiClient) {
    this.managementApiClient = managementApiClient;
  }

  public async getTokenForFlowNodeInstance(
    processModelId: string,
    correlationId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryEntryList> {
    const tokenHistoryEntries: Array<
      DataModels.TokenHistory.TokenHistoryEntry
    > = (await this.managementApiClient.getTokensForFlowNode(
      identity,
      correlationId,
      processModelId,
      flowNodeId,
    )) as any;

    const tokenHistoryEntryList: DataModels.TokenHistory.TokenHistoryEntryList = {
      tokenHistoryEntries: tokenHistoryEntries,
      totalCount: tokenHistoryEntries.length,
    };

    return tokenHistoryEntryList;
  }

  public async getTokenForFlowNodeByProcessInstanceId(
    processInstanceId: string,
    flowNodeId: string,
    identity: IIdentity,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup> {
    type OldTokenHistoryGroup = {
      [name: string]: Array<DataModels.TokenHistory.TokenHistoryEntry>;
    };

    const oldTokenHistoryGroup: OldTokenHistoryGroup = (await this.managementApiClient.getTokensForFlowNodeByProcessInstanceId(
      identity,
      processInstanceId,
      flowNodeId,
    )) as any;
    const oldTokenHistoryKeys: Array<string> = Object.keys(oldTokenHistoryGroup);

    const tokenHistoryGroup: DataModels.TokenHistory.TokenHistoryGroup = {};

    oldTokenHistoryKeys.forEach((key: string) => {
      const tokenHistoryEntryList: DataModels.TokenHistory.TokenHistoryEntryList = {
        tokenHistoryEntries: oldTokenHistoryGroup[key],
        totalCount: oldTokenHistoryGroup[key].length,
      };

      tokenHistoryGroup[key] = tokenHistoryEntryList;
    });

    return tokenHistoryGroup;
  }
}
