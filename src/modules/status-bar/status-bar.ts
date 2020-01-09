import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {computedFrom, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import $ from 'jquery';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {DiffMode, ISolutionEntry, ISolutionService, NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';
import {isRunningInElectron} from '../../services/is-running-in-electron-module/is-running-in-electron.module';

type UpdateProgressData = {
  bytesPerSecond: number;
  delta: number;
  percent: number;
  total: number;
  transferred: number;
};

@inject(EventAggregator, Router, 'SolutionService', 'NotificationService')
export class StatusBar {
  public showDiagramViewButtons: boolean = false;
  public diffIsShown: boolean = false;
  public currentDiffMode: DiffMode;
  public xmlIsShown: boolean = false;
  public showInspectCorrelationButtons: boolean = false;
  public showChangeList: boolean = false;
  public currentXmlIdentifier: string = 'New';
  public previousXmlIdentifier: string = 'Old';
  public showInspectPanel: boolean = true;
  public activeSolutionEntry: ISolutionEntry;
  public activeDiagram: IDiagram;

  public updateProgressData: UpdateProgressData;
  public updateVersion: string;
  public updateAvailable: boolean = false;
  public updateDropdown: HTMLElement;
  public updateDropdownToggle: HTMLElement;
  public updateDownloadFinished: boolean = false;
  public updateStarted: boolean = false;

  public diffMode: typeof DiffMode = DiffMode;

  private eventAggregator: EventAggregator;
  private router: Router;
  private solutionService: ISolutionService;
  private subscriptions: Array<Subscription>;
  private designView: string;
  private ipcRenderer: any;
  private notificationService: NotificationService;

  constructor(
    eventAggregator: EventAggregator,
    router: Router,
    solutionService: ISolutionService,
    notificationService: NotificationService,
  ) {
    this.eventAggregator = eventAggregator;
    this.router = router;
    this.solutionService = solutionService;
    this.notificationService = notificationService;

    if (isRunningInElectron()) {
      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;

      this.ipcRenderer.on('update_error', () => {
        notificationService.showNotification(NotificationType.INFO, 'Update Error!');
      });

      this.ipcRenderer.on('update_available', (event: Event, version: string) => {
        this.updateAvailable = true;
        this.updateVersion = version;

        const message: string =
          'A new update is available.\nPlease click on the BPMN Studio icon in the statusbar to start the download.';

        const toastrOptions: ToastrOptions = {
          onclick: (notificationClickEvent: Event) => {
            notificationClickEvent.stopPropagation();

            const updateDropdownIsHidden: boolean = $(this.updateDropdown).is(':hidden');
            if (updateDropdownIsHidden) {
              this.updateDropdownToggle.click();
            }
          },
        };

        this.notificationService.showNonDisappearingNotification(NotificationType.INFO, message, toastrOptions);
      });

      this.ipcRenderer.on('update_download_progress', (event: Event, updateProgressData: UpdateProgressData) => {
        this.updateProgressData = updateProgressData;
      });

      this.ipcRenderer.on('update_downloaded', () => {
        this.updateDownloadFinished = true;
      });
    }
  }

  public async attached(): Promise<void> {
    this.subscriptions = [
      this.eventAggregator.subscribe(environment.events.statusBar.showDiagramViewButtons, () => {
        this.showDiagramViewButtons = true;
      }),

      this.eventAggregator.subscribe(environment.events.statusBar.hideDiagramViewButtons, () => {
        this.showDiagramViewButtons = false;
        this.xmlIsShown = false;
        this.diffIsShown = false;
        this.showChangeList = false;
        this.currentDiffMode = DiffMode.NewVsOld;
      }),

      this.eventAggregator.subscribe(environment.events.statusBar.setXmlIdentifier, (xmlIdentifier: Array<string>) => {
        [this.previousXmlIdentifier, this.currentXmlIdentifier] = xmlIdentifier;
      }),

      this.eventAggregator.subscribe(
        environment.events.statusBar.showInspectCorrelationButtons,
        (showInspectCorrelation: boolean) => {
          this.showInspectCorrelationButtons = showInspectCorrelation;
        },
      ),

      this.eventAggregator.subscribe('router:navigation:success', async () => {
        await this.updateStatusBar();
        this.refreshRightButtons();
      }),
    ];

    $(document).on('click', '.update-dropdown', (event: Event) => {
      event.stopPropagation();
    });

    await this.updateStatusBar();

    this.refreshRightButtons();

    this.currentDiffMode = DiffMode.NewVsOld;
  }

  public detached(): void {
    this.disposeAllSubscriptions();
  }

  @computedFrom('updateProgressData')
  public get isDownloading(): boolean {
    return this.updateProgressData !== undefined;
  }

  public toggleXMLView(): void {
    if (this.diffIsShown) {
      this.toggleDiffView();
    }

    this.designView = this.xmlIsShown ? 'detail' : 'xml';

    this.router.navigateToRoute('design', {
      diagramName: this.activeDiagram ? this.activeDiagram.name : undefined,
      diagramUri: this.activeDiagram ? this.activeDiagram.uri : undefined,
      solutionUri: this.activeSolutionEntry.uri,
      view: this.designView,
    });

    this.xmlIsShown = !this.xmlIsShown;
  }

  public changeDiffMode(mode: DiffMode): void {
    this.currentDiffMode = mode;
    this.eventAggregator.publish(environment.events.diffView.changeDiffMode, mode);
  }

  public toggleChangeList(): void {
    this.showChangeList = !this.showChangeList;
    this.eventAggregator.publish(environment.events.diffView.toggleChangeList);
  }

  public toggleDiffView(): void {
    if (this.xmlIsShown) {
      this.toggleXMLView();
    }

    this.designView = this.diffIsShown ? 'detail' : 'diff';

    this.router.navigateToRoute('design', {
      diagramName: this.activeDiagram ? this.activeDiagram.name : undefined,
      diagramUri: this.activeDiagram ? this.activeDiagram.uri : undefined,
      solutionUri: this.activeSolutionEntry.uri,
      view: this.designView,
    });

    this.diffIsShown = !this.diffIsShown;
  }

  public toggleInspectPanel(): void {
    this.showInspectPanel = !this.showInspectPanel;

    this.eventAggregator.publish(environment.events.inspectCorrelation.showInspectPanel, this.showInspectPanel);
  }

  public showReleaseNotes(): void {
    this.ipcRenderer.send('show_release_notes');
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

    this.ipcRenderer.send('download_update');
    this.updateStarted = true;
  }

  public installUpdate(): void {
    this.ipcRenderer.send('quit_and_install');
  }

  public cancelUpdate(): void {
    this.ipcRenderer.send('cancel_update');

    this.updateProgressData = undefined;
    this.updateStarted = false;
  }

  private refreshRightButtons(): void {
    const currentView: string = this.router.currentInstruction.params.view;
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

  private disposeAllSubscriptions(): void {
    this.subscriptions.forEach((subscription: Subscription) => {
      subscription.dispose();
    });
  }

  private async updateStatusBar(): Promise<void> {
    const solutionUriFromNavigation: string = this.router.currentInstruction.queryParams.solutionUri;

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(solutionUriFromNavigation);

    const solutionIsSet: boolean = this.activeSolutionEntry !== undefined;
    const diagramName: string = this.router.currentInstruction.params.diagramName;
    const diagramIsSet: boolean = diagramName !== undefined;

    if (solutionIsSet && diagramIsSet) {
      const activeSolutionIsOpenDiagramSolution: boolean = solutionUriFromNavigation === 'about:open-diagrams';
      if (activeSolutionIsOpenDiagramSolution) {
        const persistedDiagrams: Array<IDiagram> = this.solutionService.getOpenDiagrams();

        this.activeDiagram = persistedDiagrams.find((diagram: IDiagram) => {
          return diagram.name === diagramName;
        });
      } else {
        this.activeDiagram = await this.activeSolutionEntry.service.loadDiagram(diagramName);
      }
    }
  }
}
