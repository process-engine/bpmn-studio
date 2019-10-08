import {inject} from 'aurelia-framework';

import {IHttpClient} from '@essential-projects/http_contracts';
import {SolutionExplorerFileSystemRepository} from '@process-engine/solutionexplorer.repository.filesystem';
import {SolutionExplorerManagementApiRepository} from '@process-engine/solutionexplorer.repository.management_api';
import {SolutionExplorerService} from '@process-engine/solutionexplorer.service';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';
import {DiagramTrashFolderService} from './diagram-trash-folder.service';

/**
 * This factory provides new instances of different solution explorer services.
 */
@inject('HttpFetchClient', 'DiagramTrashFolderService')
export class SolutionExplorerServiceFactory {
  private httpClient: IHttpClient;
  private diagramTrashFolderService: DiagramTrashFolderService;

  constructor(httpClient: IHttpClient, diagramTrashFolderService: DiagramTrashFolderService) {
    this.httpClient = httpClient;
    this.diagramTrashFolderService = diagramTrashFolderService;
  }

  public async newFileSystemSolutionExplorer(): Promise<ISolutionExplorerService> {
    const diagramTrashFolder: string = this.diagramTrashFolderService.getDiagramTrashFolder();

    const fileSystemRepository: SolutionExplorerFileSystemRepository = new SolutionExplorerFileSystemRepository(
      diagramTrashFolder,
    );
    const createdService: SolutionExplorerService = new SolutionExplorerService(fileSystemRepository);

    return createdService;
  }

  public async newManagementApiSolutionExplorer(): Promise<ISolutionExplorerService> {
    const managementApiRepository: SolutionExplorerManagementApiRepository = new SolutionExplorerManagementApiRepository(
      this.httpClient,
    );
    const createdService: SolutionExplorerService = new SolutionExplorerService(managementApiRepository);

    return createdService;
  }
}
