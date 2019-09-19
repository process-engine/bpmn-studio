import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';
import {StartCallbackType} from '@process-engine/management_api_contracts/dist/data_models/process_models';
import {OnProcessEndedCallback} from '@process-engine/management_api_contracts/dist/messages/callback_types';

export interface IDiagramDetailService {
  getStartEventsForProcessModel(identity: IIdentity, processModelId: string): Promise<DataModels.Events.EventList>;
  startProcessInstance(
    identity: IIdentity,
    processModelId: string,
    startRequestPayload?: DataModels.ProcessModels.ProcessStartRequestPayload,
    startCallbackType?: StartCallbackType,
    startEventId?: string,
    endEventId?: string,
    processEndedCallback?: OnProcessEndedCallback,
  ): Promise<DataModels.ProcessModels.ProcessStartResponsePayload>;
}
