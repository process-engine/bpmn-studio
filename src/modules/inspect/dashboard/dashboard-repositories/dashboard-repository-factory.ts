import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {IDashboardRepository} from '../contracts/index';

import {
  processEngineSupportsGettingProcessInstances,
  processEngineSupportsPagination,
} from '../../../../services/process-engine-version-module/process-engine-version-module';
import {DashboardGetProcessInstanceRepository} from './dashboard-get-process-instance-repository';
import {DashboardPaginationRepository} from './dashboard-pagination-repository';
import {DashboardRepository} from './dashboard-repository';

export function createDashboardRepository(
  managementApiClient: IManagementApiClient,
  runtimeVersion: string,
): IDashboardRepository {
  if (processEngineSupportsGettingProcessInstances(runtimeVersion)) {
    return new DashboardGetProcessInstanceRepository(managementApiClient);
  }
  if (processEngineSupportsPagination(runtimeVersion)) {
    return new DashboardPaginationRepository(managementApiClient);
  }

  return new DashboardRepository(managementApiClient);
}
