import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {computedFrom, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {DiffMode, ISolutionEntry, ISolutionService, NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';

type UpdateProgressData = {
  bytesPerSecond: number
  delta: number
  percent: number
  total: number
  transferred: number,
};

@inject(EventAggregator, Router, 'SolutionService', 'NotificationService')
export class StatusBar {

  public showDiagramViewButtons: boolean = false;
  public diffIsShown: boolean = false;
  public currentDiffMode: DiffMode;
  public xmlIsShown: boolean = false;
  public showInspectCorrelationButtons: boolean = false;
  public showChangeList: boolean = false;
  public currentXmlIdentifier: string;
  public previousXmlIdentifier: string;
  public showInspectPanel: boolean = true;
  public activeSolutionEntry: ISolutionEntry;
  public activeDiagram: IDiagram;

  public updateProgressData: UpdateProgressData;
  public updateVersion: string;
  public updateAvailable: boolean = false;
  public updateDropdown: HTMLElement;
  public updateDownloadFinished: boolean = false;
  public updateStarted: boolean = false;

  public DiffMode: typeof DiffMode = DiffMode;

  private _eventAggregator: EventAggregator;
  private _router: Router;
  private _solutionService: ISolutionService;
  private _subscriptions: Array<Subscription>;
  private _designView: string;
  private _ipcRenderer: any;
  private _notificationService: NotificationService;

  constructor(eventAggregator: EventAggregator, router: Router, solutionService: ISolutionService, notificationService: NotificationService) {
    this._eventAggregator = eventAggregator;
    this._router = router;
    this._solutionService = solutionService;
    this._notificationService = notificationService;

    const applicationRunsInElectron: boolean = (window as any).nodeRequire !== undefined;
    if (applicationRunsInElectron) {
      this._ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;

      this._ipcRenderer.on('update_error', () => {
        notificationService.showNotification(NotificationType.INFO, 'Update Error!');
      });

      this._ipcRenderer.on('update_available', (event: Event, version: string) => {
        this.updateAvailable = true;
        this.updateVersion = version;

        const message: string = `A new update is available.\nPlease click on the BPMN-Studio icon in the statusbar to start the download.`;

        this._notificationService.showNonDisappearingNotification(NotificationType.INFO, message);
      });

      this._ipcRenderer.on('update_download_progress', (event: Event, updateProgressData: UpdateProgressData) => {
        this.updateProgressData = updateProgressData;
      });

      this._ipcRenderer.on('update_downloaded', () => {
        this.updateDownloadFinished = true;
      });
    }
  }

  public async attached(): Promise<void> {
    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.statusBar.showDiagramViewButtons, () => {
        this.showDiagramViewButtons = true;
      }),

      this._eventAggregator.subscribe(environment.events.statusBar.hideDiagramViewButtons, () => {
        this.showDiagramViewButtons = false;
        this.xmlIsShown = false;
        this.diffIsShown = false;
        this.showChangeList = false;
        this.currentDiffMode = DiffMode.NewVsOld;
      }),

      this._eventAggregator.subscribe(environment.events.statusBar.setXmlIdentifier, (xmlIdentifier: Array<string>) => {
        [this.previousXmlIdentifier, this.currentXmlIdentifier] = xmlIdentifier;
      }),

      this._eventAggregator.subscribe(environment.events.statusBar.showInspectCorrelationButtons, (showInspectCorrelation: boolean) => {
        this.showInspectCorrelationButtons = showInspectCorrelation;
      }),

      this._eventAggregator.subscribe('router:navigation:success', async() => {
        await this._updateStatusBar();
        this._refreshRightButtons();
      }),
    ];

    $(document).on('click', '.update-dropdown', (event: Event) => {
      event.stopPropagation();
    });

    await this._updateStatusBar();

    this._refreshRightButtons();

    this.currentDiffMode = DiffMode.NewVsOld;
  }

  public detached(): void {
    this._disposeAllSubscriptions();
  }

  @computedFrom('updateProgressData')
  public get isDownloading(): boolean {
    return this.updateProgressData !== undefined;
  }

  public toggleXMLView(): void {
    if (this.diffIsShown) {
      this.toggleDiffView();
    }

    this._designView = this.xmlIsShown ? 'detail' : 'xml';

    this._router.navigateToRoute('design', {
      diagramName: this.activeDiagram ? this.activeDiagram.name : undefined,
      diagramUri: this.activeDiagram ? this.activeDiagram.uri : undefined,
      solutionUri: this.activeSolutionEntry.uri,
      view: this._designView,
    });

    this.xmlIsShown = !this.xmlIsShown;
  }

  public changeDiffMode(mode: DiffMode): void {
    this.currentDiffMode = mode;
    this._eventAggregator.publish(environment.events.diffView.changeDiffMode, mode);
  }

  public toggleChangeList(): void {
    this.showChangeList = !this.showChangeList;
    this._eventAggregator.publish(environment.events.diffView.toggleChangeList);
  }

  public toggleDiffView(): void {
    if (this.xmlIsShown) {
      this.toggleXMLView();
    }

    this._designView = this.diffIsShown ? 'detail' : 'diff';

    this._router.navigateToRoute('design', {
      diagramName: this.activeDiagram ? this.activeDiagram.name : undefined,
      diagramUri: this.activeDiagram ? this.activeDiagram.uri : undefined,
      solutionUri: this.activeSolutionEntry.uri,
      view: this._designView,
    });

    this.diffIsShown = !this.diffIsShown;
  }

  public toggleInspectPanel(): void {
    this.showInspectPanel = !this.showInspectPanel;

    this._eventAggregator.publish(environment.events.inspectCorrelation.showInspectPanel, this.showInspectPanel);
  }

  public showReleaseNotes(): void {
    this._ipcRenderer.send('show_release_notes');
  }

  public hideDropdown(): void {
    if (this.updateStarted) {
      return;
    }

    this.updateDropdown.classList.remove('show');
  }

  public startUpdate(): void {
    if (this.updateStarted) {
      return;
    }

    this._ipcRenderer.send('download_update');
    this.updateStarted = true;
  }

  public installUpdate(): void {
    this._ipcRenderer.send('quit_and_install');
  }

  public cancelUpdate(): void {
    this._ipcRenderer.send('cancel_update');

    this.updateProgressData = undefined;
  }

  private _refreshRightButtons(): void {
    const currentView: string = this._router.currentInstruction.params.view;
    switch (currentView) {
      case 'xml':
        this.xmlIsShown = true;
        break;
      case 'diff':
        this.diffIsShown = true;
        break;
      default:
        this.xmlIsShown = false;
        this.diffIsShown = false;
        break;
    }
  }

  private _disposeAllSubscriptions(): void {
    this._subscriptions.forEach((subscription: Subscription) => {
      subscription.dispose();
    });
  }

  private async _updateStatusBar(): Promise<void> {
    const solutionUriFromNavigation: string = this._router.currentInstruction.queryParams.solutionUri;

    this.activeSolutionEntry = this._solutionService.getSolutionEntryForUri(solutionUriFromNavigation);

    const solutionIsSet: boolean = this.activeSolutionEntry !== undefined;
    const diagramName: string = this._router.currentInstruction.params.diagramName;
    const diagramIsSet: boolean = diagramName !== undefined;

    if (solutionIsSet && diagramIsSet) {
      const activeSolutionIsOpenDiagramSolution: boolean = solutionUriFromNavigation === 'about:open-diagrams';
      if (activeSolutionIsOpenDiagramSolution) {
        const persistedDiagrams: Array<IDiagram> = this._solutionService.getOpenDiagrams();

        this.activeDiagram = persistedDiagrams.find((diagram: IDiagram) => {
          return diagram.name === diagramName;
        });
      } else {
        this.activeDiagram = await this.activeSolutionEntry
          .service
          .loadDiagram(diagramName);
      }
    }
  }
}
