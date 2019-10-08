import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';

import {StartCallbackType} from '@process-engine/management_api_contracts/dist/data_models/process_models';
import {OnProcessEndedCallback} from '@process-engine/management_api_contracts/dist/messages/callback_types';
import {IDiagramDetailRepository} from '../contracts';

export class DiagramDetailRepository implements IDiagramDetailRepository {
  protected managementApiClient: IManagementApiClient;

  constructor(managementApiClient: IManagementApiClient) {
    this.managementApiClient = managementApiClient;
  }

  public async getStartEventsForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.Events.EventList> {
    const startEvents: {
      events: Array<DataModels.Events.Event>;
    } = (await this.managementApiClient.getStartEventsForProcessModel(identity, processModelId)) as any;

    const eventList: DataModels.Events.EventList = {
      events: startEvents.events,
      totalCount: startEvents.events.length,
    };

    return eventList;
  }

  public startProcessInstance(
    identity: IIdentity,
    processModelId: string,
    startRequestPayload?: DataModels.ProcessModels.ProcessStartRequestPayload,
    startCallbackType?: StartCallbackType,
    startEventId?: string,
    endEventId?: string,
    processEndedCallback?: OnProcessEndedCallback,
  ): Promise<DataModels.ProcessModels.ProcessStartResponsePayload> {
    return this.managementApiClient.startProcessInstance(
      identity,
      processModelId,
      startRequestPayload,
      startCallbackType,
      startEventId,
      endEventId,
      processEndedCallback,
    );
  }
}
