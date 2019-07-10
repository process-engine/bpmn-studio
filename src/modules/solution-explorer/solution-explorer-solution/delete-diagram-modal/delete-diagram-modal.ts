/* tslint:disable:no-use-before-declare */
/**
 * We are disabling this rule here because we need this kind of statement in the
 * functions used in the promise of the modal.
*/
import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

import {IEventFunction, ISolutionService, NotificationType} from '../../../../contracts/index';
import {NotificationService} from '../../../../services/notification-service/notification.service';
import {OpenDiagramsSolutionExplorerService} from '../../../../services/solution-explorer-services/OpenDiagramsSolutionExplorerService';
import {OpenDiagramStateService} from '../../../../services/solution-explorer-services/OpenDiagramStateService';

@inject('NotificationService', 'OpenDiagramStateService', Router, 'OpenDiagramService', 'SolutionService')
export class DeleteDiagramModal {
  public showModal: boolean = false;
  public diagram: IDiagram;
  public deleteDiagramModal: DeleteDiagramModal = this;

  private _solutionExplorerService: ISolutionExplorerService;
  private _notificationService: NotificationService;
  private _openDiagramStateService: OpenDiagramStateService;
  private _openDiagramService: OpenDiagramsSolutionExplorerService;
  private _router: Router;
  private _solutionService: ISolutionService;

  constructor(
    notificationService: NotificationService,
    openDiagramStateService: OpenDiagramStateService,
    router: Router,
    openDiagramService: OpenDiagramsSolutionExplorerService,
    solutionService: ISolutionService,
  ) {
    this._notificationService = notificationService;
    this._openDiagramStateService = openDiagramStateService;
    this._router = router;
    this._openDiagramService = openDiagramService;
    this._solutionService = solutionService;
  }

  public async show(diagram: IDiagram, solutionExplorerService: ISolutionExplorerService): Promise<boolean> {
    this.diagram = diagram;
    this._solutionExplorerService = solutionExplorerService;

    this.showModal = true;

    const deletionPromise: Promise<boolean> = new Promise((resolve: Function, reject: Function): void => {
      const cancelDeletion: IEventFunction = (): void => {
        this._closeModal();

        resolve(false);

        document.getElementById('cancelDeleteDiagramButton').removeEventListener('click', cancelDeletion);
        document.getElementById('deleteDiagramButton').removeEventListener('click', proceedDeletion);
      };

      const proceedDeletion: IEventFunction = async(): Promise<void> => {
        await this._deleteDiagram();

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

  private _closeModal(): void {
    this.diagram = undefined;
    this._solutionExplorerService = undefined;

    this.showModal = false;
  }

  private async _deleteDiagram(): Promise<void> {
    try {
      await this._solutionExplorerService.deleteDiagram(this.diagram);
    } catch (error) {
      const message: string = `Unable to delete the diagram: ${error.message}`;

      this._notificationService.showNotification(NotificationType.ERROR, message);
    }

    const diagramIndex: number = this._openDiagramService
      .getOpenedDiagrams()
      .findIndex((diagram: IDiagram) => diagram.uri === this.diagram.uri);

    const previousOrNextDiagramIndex: number = diagramIndex === 0 ? diagramIndex + 1 : diagramIndex - 1;

    const diagramToNavigateTo: IDiagram = this._openDiagramService
      .getOpenedDiagrams()
      .find((diagram: IDiagram, index: number) => index === previousOrNextDiagramIndex);

    const diagramIsDeployed: boolean = this.diagram.uri.startsWith('http');

    if (diagramIsDeployed || !diagramToNavigateTo) {
      this._router.navigateToRoute('start-page');
    } else {
      const lastIndexOfSlash: number = diagramToNavigateTo.uri.lastIndexOf('/');
      const lastIndexOfBackSlash: number = diagramToNavigateTo.uri.lastIndexOf('\\');
      const indexBeforeFilename: number = Math.max(lastIndexOfSlash, lastIndexOfBackSlash);
      const activeSolutionUri: string = diagramToNavigateTo.uri.substring(0, indexBeforeFilename);

      this._router.navigateToRoute('design', {
        diagramName: diagramToNavigateTo.name,
        diagramUri: diagramToNavigateTo.uri,
        solutionUri: activeSolutionUri,
        view: this._router.currentInstruction.params.view,
      });
    }

    this._openDiagramService.closeDiagram(this.diagram);
    this._solutionService.removeOpenDiagramByUri(this.diagram.uri);
    this._openDiagramStateService.deleteDiagramState(this.diagram.uri);

    this.diagram = undefined;
    this._solutionExplorerService = undefined;

    this.showModal = false;
  }
}
