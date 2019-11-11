import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApiClient} from '@process-engine/management_api_contracts';
import {ManagementApiClient} from '@process-engine/management_api_client';
import {StartCallbackType} from '@process-engine/management_api_contracts/dist/data_models/process_models';
import {OnProcessEndedCallback} from '@process-engine/management_api_contracts/dist/messages/callback_types';

import {IDiagramDetailRepository, IDiagramDetailService} from '../contracts/index';
import {ISolutionEntry} from '../../../../contracts';

import environment from '../../../../environment';
import {createDiagramDetailRepository} from '../repository/diagram-detail-repository-factory';

@inject(EventAggregator, ManagementApiClient)
export class DiagramDetailService implements IDiagramDetailService {
  private diagramDetailRepository: IDiagramDetailRepository;

  constructor(eventAggregator: EventAggregator, managementApiClient: IManagementApiClient) {
    eventAggregator.subscribe(environment.events.configPanel.solutionEntryChanged, (solutionEntry: ISolutionEntry) => {
      if ((managementApiClient as any).managementApiAccessor === undefined) {
        return;
      }

      this.diagramDetailRepository = createDiagramDetailRepository(
        managementApiClient,
        solutionEntry.processEngineVersion,
      );
    });
  }

  public getStartEventsForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.Events.EventList> {
    return this.diagramDetailRepository.getStartEventsForProcessModel(identity, processModelId);
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
    return this.diagramDetailRepository.startProcessInstance(
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
