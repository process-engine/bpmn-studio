import {IManagementApiClient} from '@process-engine/management_api_contracts';
import {IDiagramDetailRepository} from '../contracts/index';

import {processEngineSupportsPagination} from '../../../../services/process-engine-version-module/process-engine-version.module';

import {DiagramDetailPaginationRepository} from './diagram-detail.pagination-repository';
import {DiagramDetailRepository} from './diagram-detail.repository';

export function createDiagramDetailRepository(
  managementApiClient: IManagementApiClient,
  runtimeVersion: string,
): IDiagramDetailRepository {
  if (processEngineSupportsPagination(runtimeVersion)) {
    return new DiagramDetailPaginationRepository(managementApiClient);
  }

  return new DiagramDetailRepository(managementApiClient);
}
