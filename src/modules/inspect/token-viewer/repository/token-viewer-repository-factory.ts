import {ITokenViewerRepository} from '../contracts/index';

import {processEngineSupportsPagination} from '../../../../services/process-engine-version-module/process-engine-version.module';

import {TokenViewerPaginationRepository} from './token-viewer.pagination-repository';
import {TokenViewerRepository} from './token-viewer.repository';

export function createTokenViewerRepository(managementApiClient, runtimeVersion: string): ITokenViewerRepository {
  if (processEngineSupportsPagination(runtimeVersion)) {
    return new TokenViewerPaginationRepository(managementApiClient);
  }

  return new TokenViewerRepository(managementApiClient);
}
