import {inject} from 'aurelia-framework';

import {Subscription} from '@essential-projects/event_aggregator_contracts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient, Messages} from '@process-engine/management_api_contracts';
import {ILiveExecutionTrackerRepository, RequestError} from '../contracts/index';

@inject('ManagementApiClientService')
export class LiveExecutionTrackerRepository implements ILiveExecutionTrackerRepository {
  protected managementApiClient: IManagementApiClient;

  protected maxRetries: number = 5;
  protected retryDelayInMs: number = 500;

  constructor(managementApiClientService?: IManagementApiClient) {
    this.managementApiClient = managementApiClientService;
  }

  public async getFlowNodeInstancesForProcessInstance(
    identity: IIdentity,
    processInstanceId: string,
  ): Promise<DataModels.FlowNodeInstances.FlowNodeInstanceList> {
    const flowNodeInstances: Array<
      DataModels.FlowNodeInstances.FlowNodeInstance
    > = (await this.managementApiClient.getFlowNodeInstancesForProcessInstance(identity, processInstanceId)) as any;

    const flowNodeInstanceList: DataModels.FlowNodeInstances.FlowNodeInstanceList = {
      flowNodeInstances: flowNodeInstances,
      totalCount: flowNodeInstances.length,
    };

    return flowNodeInstanceList;
  }

  public async getCorrelationById(
    identity: IIdentity,
    correlationId: string,
  ): Promise<DataModels.Correlations.Correlation> {
    // This is necessary because the managementApi sometimes throws an error when the correlation is not yet existing.
    for (let retries: number = 0; retries < this.maxRetries; retries++) {
      try {
        return await this.managementApiClient.getCorrelationById(identity, correlationId);
      } catch {
        await new Promise((resolve: Function): void => {
          setTimeout(() => {
            resolve();
          }, this.retryDelayInMs);
        });
      }
    }

    return undefined;
  }

  public async isProcessInstanceActive(identity: IIdentity, processInstanceId: string): Promise<boolean> {
    const getActiveTokens: Function = async (): Promise<Array<DataModels.Kpi.ActiveToken> | RequestError> => {
      for (let retries: number = 0; retries < this.maxRetries; retries++) {
        try {
          return (await this.managementApiClient.getActiveTokensForProcessInstance(identity, processInstanceId)) as any;
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
        type OldTokenHistoryGroup = {
          [name: string]: Array<DataModels.TokenHistory.TokenHistoryEntry>;
        };

        const oldTokenHistoryGroup: OldTokenHistoryGroup = (await this.managementApiClient.getTokensForProcessInstance(
          identity,
          processInstanceId,
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
        const activeTokens: Array<
          DataModels.Kpi.ActiveToken
        > = (await this.managementApiClient.getActiveTokensForProcessInstance(identity, processInstanceId)) as any;

        const activeTokenList: DataModels.Kpi.ActiveTokenList = {
          activeTokens: activeTokens,
          totalCount: activeTokens.length,
        };

        return activeTokenList;
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
        const emptyActivities: {
          emptyActivities: Array<DataModels.EmptyActivities.EmptyActivity>;
        } = (await this.managementApiClient.getEmptyActivitiesForProcessInstance(identity, processInstanceId)) as any;

        const emptyActivityList: DataModels.EmptyActivities.EmptyActivityList = {
          emptyActivities: emptyActivities.emptyActivities,
          totalCount: emptyActivities.emptyActivities.length,
        };

        return emptyActivityList;
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

  public async finishEmptyActivity(
    identity: IIdentity,
    processInstanceId: string,
    correlationId: string,
    emptyActivity: DataModels.EmptyActivities.EmptyActivity,
  ): Promise<void> {
    return this.managementApiClient.finishEmptyActivity(
      identity,
      processInstanceId,
      correlationId,
      emptyActivity.flowNodeInstanceId,
    );
  }

  public async getProcessModelById(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.ProcessModels.ProcessModel> {
    return this.managementApiClient.getProcessModelById(identity, processModelId);
  }

  public createProcessEndedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onProcessEnded(
      identity,
      (message: Messages.BpmnEvents.EndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createProcessErrorEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onProcessError(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createProcessTerminatedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onProcessTerminated(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createUserTaskWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onUserTaskWaiting(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createActivityReachedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onActivityReached(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createActivityFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onActivityFinished(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createUserTaskFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onUserTaskFinished(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createManualTaskWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onManualTaskWaiting(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createManualTaskFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onManualTaskFinished(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createEmptyActivityWaitingEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onEmptyActivityWaiting(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createEmptyActivityFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onEmptyActivityFinished(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createBoundaryEventTriggeredEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onBoundaryEventTriggered(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createIntermediateThrowEventTriggeredEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onIntermediateThrowEventTriggered(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createIntermediateCatchEventReachedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onIntermediateCatchEventReached(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public createIntermediateCatchEventFinishedEventListener(
    identity: IIdentity,
    processInstanceId: string,
    callback: Function,
  ): Promise<Subscription> {
    return this.managementApiClient.onIntermediateCatchEventFinished(
      identity,
      (message: Messages.BpmnEvents.TerminateEndEventReachedMessage): void => {
        const eventIsForAnotherProcessInstance: boolean = message.processInstanceId !== processInstanceId;
        if (eventIsForAnotherProcessInstance) {
          return;
        }

        callback();
      },
    );
  }

  public removeSubscription(identity: IIdentity, subscription: Subscription): Promise<void> {
    return this.managementApiClient.removeSubscription(identity, subscription);
  }

  public terminateProcess(identity: IIdentity, processInstanceId: string): Promise<void> {
    return this.managementApiClient.terminateProcessInstance(identity, processInstanceId);
  }
}
