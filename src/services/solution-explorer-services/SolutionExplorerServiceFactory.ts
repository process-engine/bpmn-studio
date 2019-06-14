import {inject} from 'aurelia-framework';

import {IHttpClient} from '@essential-projects/http_contracts';
import {SolutionExplorerFileSystemRepository} from '@process-engine/solutionexplorer.repository.filesystem';
import {SolutionExplorerManagementApiRepository} from '@process-engine/solutionexplorer.repository.management_api';
import {SolutionExplorerService} from '@process-engine/solutionexplorer.service';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

/**
 * This factory provides new instances of different solution explorer services.
 */
@inject('HttpFetchClient')
export class SolutionExplorerServiceFactory {

  private _httpClient: IHttpClient;

  constructor(httpClient: IHttpClient) {
    this._httpClient = httpClient;
  }

  public async newFileSystemSolutionExplorer(): Promise<ISolutionExplorerService> {
    const fileSystemRepository: SolutionExplorerFileSystemRepository = new SolutionExplorerFileSystemRepository();
    const createdService: SolutionExplorerService = new SolutionExplorerService(fileSystemRepository);

    return createdService;
  }

  public async newManagementApiSolutionExplorer(): Promise<ISolutionExplorerService> {
    const managementApiRepository: SolutionExplorerManagementApiRepository = new SolutionExplorerManagementApiRepository(this._httpClient);
    const createdService: SolutionExplorerService = new SolutionExplorerService(managementApiRepository);

    return createdService;
  }
}
