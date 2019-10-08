import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {IDashboardRepository} from '../contracts/index';

import {processEngineSupportsPagination} from '../../../../services/process-engine-version-module/process-engine-version.module';
import {DashboardPaginationRepository} from './dashboard.pagination-repository';
import {DashboardRepository} from './dashboard.repository';

export function createDashboardRepository(
  managementApiClient: IManagementApiClient,
  runtimeVersion: string,
): IDashboardRepository {
  if (processEngineSupportsPagination(runtimeVersion)) {
    return new DashboardPaginationRepository(managementApiClient);
  }

  return new DashboardRepository(managementApiClient);
}
