import {IIdentity} from '@essential-projects/iam_contracts';

import {DataModels} from '@process-engine/management_api_contracts';
import {DashboardPaginationRepository} from './dashboard-pagination-repository';
import {IDashboardRepository} from '../contracts/index';

export class DashboardGetProcessInstanceRepository extends DashboardPaginationRepository
  implements IDashboardRepository {
  public getAllActiveProcessInstances(
    identity: IIdentity,
    offset?: number,
    limit?: number,
  ): Promise<DataModels.Correlations.ProcessInstanceList> {
    return this.managementApiService.getProcessInstancesByState(
      identity,
      DataModels.Correlations.CorrelationState.running,
      offset,
      limit,
    );
  }
}
