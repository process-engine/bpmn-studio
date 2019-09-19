import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/management_api_contracts';
import {LiveExecutionTrackerRepository} from './live-execution-tracker.repository';
import {ILiveExecutionTrackerRepository, RequestError} from '../contracts/index';

export class LiveExecutionTrackerPaginationRepository extends LiveExecutionTrackerRepository
  implements ILiveExecutionTrackerRepository {
  public async getFlowNodeInstancesForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.FlowNodeInstances.FlowNodeInstanceList> {
    return this.managementApiClient.getFlowNodeInstancesForProcessInstance(identity, processInstanceId);
  }

  public async isProcessInstanceActive(identity: IIdentity, processInstanceId: string): Promise<boolean> {
    const getActiveTokens: Function = async (): Promise<Array<DataModels.Kpi.ActiveToken> | RequestError> => {
      for (let retries: number = 0; retries < this.maxRetries; retries++) {
        try {
          return (await this.managementApiClient.getActiveTokensForProcessInstance(identity, processInstanceId))
            .activeTokens;
        } catch (error) {
          const errorIsConnectionLost: boolean = error.message === 'Failed to fetch';

          if (errorIsConnectionLost) {
            return RequestError.ConnectionLost;
          }
        }
      }

      return RequestError.OtherError;
    };

    const activeTokensOrRequestError: Array<DataModels.Kpi.ActiveToken> | RequestError = await getActiveTokens();

    const couldNotGetActiveTokens: boolean =
      activeTokensOrRequestError === RequestError.ConnectionLost ||
      activeTokensOrRequestError === RequestError.OtherError;
    if (couldNotGetActiveTokens) {
      const requestError: RequestError = activeTokensOrRequestError as RequestError;

      throw requestError;
    }

    const allActiveTokens: Array<DataModels.Kpi.ActiveToken> = activeTokensOrRequestError as Array<
      DataModels.Kpi.ActiveToken
    >;

    const correlationIsActive: boolean = allActiveTokens.length > 0;

    return correlationIsActive;
  }

  public async getTokenHistoryGroupForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.TokenHistory.TokenHistoryGroup | null> {
    for (let retries: number = 0; retries < this.maxRetries; retries++) {
      try {
        const a = await this.managementApiClient.getTokensForProcessInstance(identity, processInstanceId);

        return a;
      } catch {
        await new Promise((resolve: Function): void => {
          setTimeout(() => {
            resolve();
          }, this.retryDelayInMs);
        });
      }
    }

    return null;
  }

  public async getActiveTokensForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.Kpi.ActiveTokenList | null> {
    for (let retries: number = 0; retries < this.maxRetries; retries++) {
      try {
        return await this.managementApiClient.getActiveTokensForProcessInstance(identity, processInstanceId);
      } catch {
        await new Promise((resolve: Function): void => {
          setTimeout(() => {
            resolve();
          }, this.retryDelayInMs);
        });
      }
    }

    return null;
  }

  public async getEmptyActivitiesForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.EmptyActivities.EmptyActivityList | null> {
    for (let retries: number = 0; retries < this.maxRetries; retries++) {
      try {
        return await this.managementApiClient.getEmptyActivitiesForProcessInstance(identity, processInstanceId);
      } catch {
        await new Promise((resolve: Function): void => {
          setTimeout(() => {
            resolve();
          }, this.retryDelayInMs);
        });
      }
    }

    return null;
  }
}
