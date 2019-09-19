import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {IDiagramDetailRepository} from '../contracts/index';

import {DiagramDetailRepository} from './diagram-detail.repository';

export class DiagramDetailPaginationRepository extends DiagramDetailRepository implements IDiagramDetailRepository {
  public getStartEventsForProcessModel(
    identity: IIdentity,
    processModelId: string,
  ): Promise<DataModels.Events.EventList> {
    return this.managementApiClient.getStartEventsForProcessModel(identity, processModelId);
  }
}
