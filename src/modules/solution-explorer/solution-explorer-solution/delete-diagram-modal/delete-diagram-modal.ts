/* tslint:disable:no-use-before-declare */
/**
 * We are disabling this rule here because we need this kind of statement in the
 * functions used in the promise of the modal.
 */
import {bindable, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

import {IEventFunction, ISolutionService, NotificationType} from '../../../../contracts/index';
import {NotificationService} from '../../../../services/notification-service/notification.service';
import {OpenDiagramsSolutionExplorerService} from '../../../../services/solution-explorer-services/open-diagrams-solution-explorer.service';
import {OpenDiagramStateService} from '../../../../services/solution-explorer-services/open-diagram-state.service';

@inject('NotificationService', 'OpenDiagramStateService', Router, 'OpenDiagramService', 'SolutionService')
export class DeleteDiagramModal {
  @bindable public activeDiagram: IDiagram;
  public showModal: boolean = false;
  public diagram: IDiagram;
  public deleteDiagramModal: DeleteDiagramModal = this;

  private solutionExplorerService: ISolutionExplorerService;
  private notificationService: NotificationService;
  private openDiagramStateService: OpenDiagramStateService;
  private openDiagramService: OpenDiagramsSolutionExplorerService;
  private router: Router;
  private solutionService: ISolutionService;

  constructor(
    notificationService: NotificationService,
    openDiagramStateService: OpenDiagramStateService,
    router: Router,
    openDiagramService: OpenDiagramsSolutionExplorerService,
    solutionService: ISolutionService,
  ) {
    this.notificationService = notificationService;
    this.openDiagramStateService = openDiagramStateService;
    this.router = router;
    this.openDiagramService = openDiagramService;
    this.solutionService = solutionService;
  }

  public async show(diagram: IDiagram, solutionExplorerService: ISolutionExplorerService): Promise<boolean> {
    this.diagram = diagram;
    this.solutionExplorerService = solutionExplorerService;

    this.showModal = true;

    const deletionPromise: Promise<boolean> = new Promise((resolve: Function, reject: Function): void => {
      const cancelDeletion: IEventFunction = (): void => {
        this.closeModal();

        resolve(false);

        document.getElementById('cancelDeleteDiagramButton').removeEventListener('click', cancelDeletion);
        document.getElementById('deleteDiagramButton').removeEventListener('click', proceedDeletion);
      };

      const proceedDeletion: IEventFunction = async (): Promise<void> => {
        await this.deleteDiagram();

        resolve(true);

        document.getElementById('cancelDeleteDiagramButton').removeEventListener('click', cancelDeletion);
        document.getElementById('deleteDiagramButton').removeEventListener('click', proceedDeletion);
      };

      setTimeout(() => {
        document.getElementById('cancelDeleteDiagramButton').addEventListener('click', cancelDeletion, {once: true});
        document.getElementById('deleteDiagramButton').addEventListener('click', proceedDeletion, {once: true});
      }, 0);
    });

    return deletionPromise;
  }

  private closeModal(): void {
    this.diagram = undefined;
    this.solutionExplorerService = undefined;

    this.showModal = false;
  }

  private async deleteDiagram(): Promise<void> {
    try {
      await this.solutionExplorerService.deleteDiagram(this.diagram);
    } catch (error) {
      const message: string = `Unable to delete the diagram: ${error.message}`;

      this.notificationService.showNotification(NotificationType.ERROR, message);
    }

    const openDiagramServiceIsAvailable: boolean = typeof this.openDiagramService !== 'string';

    const diagramWasActiveDiagram: boolean = this.diagram === this.activeDiagram;
    if (diagramWasActiveDiagram) {
      const diagramIndex: number = openDiagramServiceIsAvailable
        ? this.openDiagramService.getOpenedDiagrams().findIndex((diagram: IDiagram) => diagram.uri === this.diagram.uri)
        : undefined;

      const previousOrNextDiagramIndex: number = diagramIndex === 0 ? diagramIndex + 1 : diagramIndex - 1;

      const diagramToNavigateTo: IDiagram = openDiagramServiceIsAvailable
        ? this.openDiagramService
            .getOpenedDiagrams()
            .find((diagram: IDiagram, index: number) => index === previousOrNextDiagramIndex)
        : undefined;

      const diagramIsDeployed: boolean = this.diagram.uri.startsWith('http');

      if (diagramIsDeployed || !diagramToNavigateTo) {
        this.router.navigateToRoute('start-page');
      } else {
        const lastIndexOfSlash: number = diagramToNavigateTo.uri.lastIndexOf('/');
        const lastIndexOfBackSlash: number = diagramToNavigateTo.uri.lastIndexOf('\\');
        const indexBeforeFilename: number = Math.max(lastIndexOfSlash, lastIndexOfBackSlash);
        const activeSolutionUri: string = diagramToNavigateTo.uri.substring(0, indexBeforeFilename);

        this.router.navigateToRoute('design', {
          diagramName: diagramToNavigateTo.name,
          diagramUri: diagramToNavigateTo.uri,
          solutionUri: activeSolutionUri,
          view: this.router.currentInstruction.params.view,
        });
      }
    }

    if (openDiagramServiceIsAvailable) {
      this.openDiagramService.closeDiagram(this.diagram);
      this.solutionService.removeOpenDiagramByUri(this.diagram.uri);
      this.openDiagramStateService.deleteDiagramState(this.diagram.uri);
    }

    this.diagram = undefined;
    this.solutionExplorerService = undefined;

    this.showModal = false;
  }
}
