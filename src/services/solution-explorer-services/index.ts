import {Container, FrameworkConfiguration} from 'aurelia-framework';

import {IHttpClient} from '@essential-projects/http_contracts';
import {SolutionExplorerFileSystemRepository} from '@process-engine/solutionexplorer.repository.filesystem';
import {SolutionExplorerManagementApiRepository} from '@process-engine/solutionexplorer.repository.management_api';
import {SolutionExplorerService} from '@process-engine/solutionexplorer.service';

import {DiagramTrashFolderService} from './diagram-trash-folder.service';
import {OpenDiagramsSolutionExplorerService} from './open-diagrams-solution-explorer.service';
import {OpenDiagramStateService} from './open-diagram-state.service';
import {SolutionExplorerServiceFactory} from './solution-explorer-service-factory';
import {isRunningInElectron} from '../is-running-in-electron-module/is-running-in-electron.module';

export async function configure(config: FrameworkConfiguration): Promise<void> {
  registerManagementApi(config.container);

  config.container.registerSingleton('SolutionExplorerServiceFactory', SolutionExplorerServiceFactory);
  config.container.registerSingleton('DiagramTrashFolderService', DiagramTrashFolderService);
  config.container.registerSingleton('OpenDiagramStateService', OpenDiagramStateService);

  if (isRunningInElectron()) {
    // only available if a filesystem is present
    registerFileSystem(config.container);
    config.container.registerSingleton('OpenDiagramService', OpenDiagramsSolutionExplorerService);
  }
}

function registerFileSystem(container: Container): void {
  const diagramTrashFolderService: DiagramTrashFolderService = new DiagramTrashFolderService();
  const diagramTrashFolder: string = diagramTrashFolderService.getDiagramTrashFolder();

  const fileSystemRepository: SolutionExplorerFileSystemRepository = new SolutionExplorerFileSystemRepository(
    diagramTrashFolder,
  );
  const filesystemSolutionexplorerService: SolutionExplorerService = new SolutionExplorerService(fileSystemRepository);

  container.registerInstance('SolutionExplorerServiceFileSystem', filesystemSolutionexplorerService);
}

function registerManagementApi(container: Container): void {
  const httpClient: IHttpClient = container.get('HttpFetchClient');
  const managementApiRepository: SolutionExplorerManagementApiRepository = new SolutionExplorerManagementApiRepository(
    httpClient,
  );
  const solutionexplorerService: SolutionExplorerService = new SolutionExplorerService(managementApiRepository);

  container.registerInstance('SolutionExplorerServiceManagementApi_NotRefreshing', solutionexplorerService);
}
