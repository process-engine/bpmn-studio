import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {NavModel, Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {BrowserWindow} from 'electron';
import {ISolutionEntry, ISolutionService, NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';
import {solutionIsRemoteSolution} from '../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';
import {isRunningInElectron} from '../../services/is-running-in-electron-module/is-running-in-electron.module';

@inject(Router, EventAggregator, 'NotificationService', 'SolutionService')
export class NavBar {
  public activeSolutionEntry: ISolutionEntry;
  public activeDiagram: IDiagram;

  public diagramInfo: HTMLElement;
  public dropdown: HTMLElement;
  public solutionExplorerIsActive: boolean = true;
  public showTools: boolean = false;
  public showInspectTools: boolean = false;
  public showExportOnInspectProcessInstance: boolean = false;
  public disableStartButton: boolean = true;
  public validationError: boolean = false;
  public showProcessName: boolean = false;
  public disableDiagramUploadButton: boolean = true;
  public disableHeatmapButton: boolean = true;
  public disableDashboardButton: boolean = false;
  public disableInspectProcessInstanceButton: boolean = false;
  public diagramContainsUnsavedChanges: boolean = false;
  public savingTargetIsRemoteSolution: boolean = false;
  public showLeftMarginInNavbar: boolean = false;

  public inspectView: string = 'dashboard';
  public designView: string = 'detail';
  public thinkView: string = 'diagram-list';

  public navbarTitle: string = '';

  public router: Router;

  private eventAggregator: EventAggregator;
  private subscriptions: Array<Subscription>;
  private notificationService: NotificationService;
  private solutionService: ISolutionService;
  private ipcRenderer: any;

  constructor(
    router: Router,
    eventAggregator: EventAggregator,
    notificationService: NotificationService,
    solutionService: ISolutionService,
  ) {
    this.router = router;
    this.eventAggregator = eventAggregator;
    this.notificationService = notificationService;
    this.solutionService = solutionService;

    if (isRunningInElectron()) {
      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
    }
  }

  public attached(): void {
    this.solutionExplorerIsActive = window.localStorage.getItem('SolutionExplorerVisibility') === 'true';

    const isMac: boolean = this.checkIfCurrentPlatformIsMac();
    if (this.ipcRenderer) {
      if (isMac) {
        this.ipcRenderer.on('toggle-fullscreen', (uselessEvent, showFullscreen) => {
          this.showLeftMarginInNavbar = !showFullscreen;
        });
      }

      this.ipcRenderer.on('menubar__start_close_diagram', this.closeDiagramOrStudioEventFunction);
    }

    const isFullscreen: boolean = !window.screenTop && !window.screenY;

    this.showLeftMarginInNavbar = isMac && !isFullscreen;

    this.updateNavbar();

    this.subscriptions = [
      this.eventAggregator.subscribe('router:navigation:success', () => {
        this.updateNavbar();
      }),

      this.eventAggregator.subscribe(environment.events.navBar.validationError, () => {
        this.validationError = true;
      }),

      this.eventAggregator.subscribe(environment.events.navBar.noValidationError, () => {
        this.validationError = false;
      }),

      this.eventAggregator.subscribe(environment.events.differsFromOriginal, (isDiagramChanged: boolean) => {
        this.diagramContainsUnsavedChanges = isDiagramChanged;
      }),

      this.eventAggregator.subscribe(environment.events.diagramWasSaved, (diagramUri: string) => {
        const activeDiagramWasSaved: boolean = diagramUri === this.activeDiagram.uri;

        if (!activeDiagramWasSaved) {
          return;
        }

        this.diagramContainsUnsavedChanges = false;
      }),

      this.eventAggregator.subscribe(environment.events.navBar.inspectNavigateToDashboard, () => {
        this.inspectView = 'dashboard';
      }),

      this.eventAggregator.subscribe(environment.events.navBar.toggleHeatmapView, () => {
        this.disableHeatmapButton = true;
        this.disableDashboardButton = false;
        this.disableInspectProcessInstanceButton = false;
      }),

      this.eventAggregator.subscribe(environment.events.navBar.toggleDashboardView, () => {
        this.disableHeatmapButton = false;
        this.disableDashboardButton = true;
        this.disableInspectProcessInstanceButton = false;
      }),

      this.eventAggregator.subscribe(environment.events.navBar.toggleInspectProcessInstanceView, () => {
        this.disableHeatmapButton = false;
        this.disableDashboardButton = false;
        this.disableInspectProcessInstanceButton = true;
      }),
    ];
  }

  public maximizeWindow = (): void => {
    if (!isRunningInElectron()) {
      return undefined;
    }

    const browserWindow: BrowserWindow = (window as any).nodeRequire('electron').remote.getCurrentWindow();

    const browserWindowIsMaximized: boolean = browserWindow.isMaximized();
    if (browserWindowIsMaximized) {
      return browserWindow.unmaximize();
    }

    return browserWindow.maximize();
  };

  public detached(): void {
    this.disposeAllSubscriptions();
    this.ipcRenderer.removeListener('menubar__start_close_diagram', this.closeDiagramOrStudioEventFunction);
  }

  private disposeAllSubscriptions(): void {
    this.subscriptions.forEach((subscription: Subscription) => {
      subscription.dispose();
    });
  }

  public navigateBack(): void {
    this.router.navigateBack();
  }

  public navigate(navModel: NavModel): void {
    switch (navModel.config.name) {
      case 'think':
        this.routerNavigate(navModel.config.name, this.thinkView);

        break;
      case 'design':
        if (this.activeDiagram === undefined) {
          this.notificationService.showNotification(
            NotificationType.INFO,
            'In order to open the designer, you have to select a diagram first!',
          );

          return;
        }
        if (navModel.isActive) {
          return;
        }

        this.routerNavigate(navModel.config.name, this.designView);

        break;
      case 'inspect':
        if (navModel.isActive) {
          return;
        }

        this.routerNavigate(navModel.config.name, this.inspectView);

        break;
      default:
        break;
    }
  }

  public showDashboard(): void {
    this.disableDashboardButton = true;
    this.disableHeatmapButton = false;
    this.disableInspectProcessInstanceButton = false;

    this.inspectView = 'dashboard';

    this.routerNavigate(this.router.currentInstruction.config.name, this.inspectView);
  }

  public showHeatmap(): void {
    this.disableHeatmapButton = true;
    this.disableDashboardButton = false;
    this.disableInspectProcessInstanceButton = false;

    this.inspectView = 'heatmap';

    this.routerNavigate(this.router.currentInstruction.config.name, this.inspectView);
  }

  public showInspectProcessInstance(): void {
    this.disableHeatmapButton = false;
    this.disableDashboardButton = false;
    this.disableInspectProcessInstanceButton = true;

    this.inspectView = 'inspect-process-instance';

    this.routerNavigate(this.router.currentInstruction.config.name, this.inspectView);
  }

  public routerNavigate(route: string, view?: string): void {
    this.router.navigateToRoute(route, {
      diagramName: this.activeDiagram ? this.activeDiagram.name : undefined,
      solutionUri: this.activeSolutionEntry ? this.activeSolutionEntry.uri : undefined,
      view: view,
    });
  }

  public toggleSolutionExplorer(): void {
    this.solutionExplorerIsActive = !this.solutionExplorerIsActive;

    this.eventAggregator.publish(
      environment.events.solutionExplorerPanel.toggleSolutionExplorer,
      this.solutionExplorerIsActive,
    );
  }

  public saveDiagram(): void {
    if (this.validationError || this.savingTargetIsRemoteSolution) {
      return;
    }

    this.eventAggregator.publish(environment.events.diagramDetail.saveDiagram);
  }

  public printDiagram(): void {
    this.eventAggregator.publish(environment.events.diagramDetail.printDiagram);
  }

  public exportDiagram(exportAs: string): void {
    const eventToPublish: string = this.showExportOnInspectProcessInstance
      ? environment.events.inspect.exportDiagramAs
      : environment.events.diagramDetail.exportDiagramAs;

    this.eventAggregator.publish(`${eventToPublish}:${exportAs}`);
  }

  public startProcess(): void {
    if (this.validationError || this.disableStartButton) {
      return;
    }

    this.eventAggregator.publish(environment.events.diagramDetail.startProcess);
  }

  public startProcessWithOptions(): void {
    if (this.validationError || this.disableStartButton) {
      return;
    }

    this.eventAggregator.publish(environment.events.diagramDetail.startProcessWithOptions);
  }

  public uploadProcess(): void {
    if (this.validationError || this.disableDiagramUploadButton) {
      return;
    }

    this.eventAggregator.publish(environment.events.diagramDetail.uploadProcess);
  }

  public get diagramUploadButtonTitle(): string {
    if (this.disableDiagramUploadButton) {
      return 'This process is already deployed to the remote ProcessEngine.';
    }

    return 'Deploy to ProcessEngine';
  }

  public get startButtonTitle(): string {
    if (this.disableStartButton) {
      return 'Please deploy the process to a ProcessEngine before starting it.';
    }

    return 'Start Process';
  }

  /**
   * Updates the title of the navbar including the navbar icon which
   * indicates, if the process was opened from the local filesystem
   * or a remote ProcessEngine
   */
  private updateNavbarTitle(): void {
    const noActiveDiagram: boolean = this.router.currentInstruction.params.diagramName === undefined;

    if (noActiveDiagram) {
      this.showProcessName = false;
      this.navbarTitle = '';

      return;
    }

    const activeSolutionIsRemoteSolution: boolean = solutionIsRemoteSolution(this.activeSolutionEntry.uri);
    this.showProcessName = this.activeDiagram.name !== undefined;

    this.navbarTitle = activeSolutionIsRemoteSolution ? this.activeDiagram.id : this.activeDiagram.name;

    this.savingTargetIsRemoteSolution = activeSolutionIsRemoteSolution;
  }

  private updateNavbarTools(): void {
    const activeRoute: string = this.router.currentInstruction.config.name;

    const activeSolutionIsRemoteSolution: boolean =
      solutionIsRemoteSolution(this.activeSolutionEntry.uri) && this.activeDiagram !== undefined;
    const activeRouteIsDiagramDetail: boolean = activeRoute === 'design';
    const activeRouteIsInspect: boolean = activeRoute === 'inspect';
    const activeRouteIsLET: boolean = activeRoute === 'live-execution-tracker';

    this.disableStartButton = !activeSolutionIsRemoteSolution;
    this.disableDiagramUploadButton = activeSolutionIsRemoteSolution;

    if (activeRouteIsDiagramDetail) {
      this.showInspectTools = false;
      this.showExportOnInspectProcessInstance = false;
      this.showTools = true;
    } else if (activeRouteIsInspect) {
      const inspectView: string = this.router.currentInstruction.params.view;
      const inspectViewIsDashboard: boolean = inspectView === 'dashboard';
      const inspectViewIsHeatmap: boolean = inspectView === 'heatmap';
      const inspectViewIsInspectProcessInstance: boolean = inspectView === 'inspect-process-instance';

      this.showInspectTools = true;

      this.disableDashboardButton = inspectViewIsDashboard;
      this.disableHeatmapButton = inspectViewIsHeatmap;
      this.disableInspectProcessInstanceButton = inspectViewIsInspectProcessInstance;

      this.showExportOnInspectProcessInstance = inspectViewIsInspectProcessInstance || false;

      this.showTools = false;
    } else if (activeRouteIsLET) {
      this.showTools = false;
      this.showInspectTools = false;
      this.showExportOnInspectProcessInstance = false;
    } else {
      this.showInspectTools = false;
      this.showTools = false;
      this.showExportOnInspectProcessInstance = false;
    }
  }

  private async updateNavbar(): Promise<void> {
    const solutionUriFromNavigation: string = this.router.currentInstruction.queryParams.solutionUri;
    const noSolutionUriSpecified: boolean = solutionUriFromNavigation === undefined;

    const solutionUri: string = noSolutionUriSpecified
      ? window.localStorage.getItem('InternalProcessEngineRoute')
      : solutionUriFromNavigation;

    if (this.router.currentInstruction.config.name !== 'preferences') {
      this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(solutionUri);
    }

    const activeSolutionIsUndefined: boolean = this.activeSolutionEntry === undefined;
    if (activeSolutionIsUndefined) {
      return;
    }

    this.savingTargetIsRemoteSolution = solutionIsRemoteSolution(this.activeSolutionEntry.uri);

    const solutionIsSet: boolean = this.activeSolutionEntry !== undefined;
    const diagramName: string = this.router.currentInstruction.params.diagramName;
    const diagramIsSet: boolean = diagramName !== undefined;

    if (solutionIsSet && diagramIsSet) {
      const activeSolutionIsOpenDiagramSolution: boolean = solutionUri === 'about:open-diagrams';
      if (activeSolutionIsOpenDiagramSolution) {
        const persistedDiagrams: Array<IDiagram> = this.solutionService.getOpenDiagrams();

        this.activeDiagram = persistedDiagrams.find((diagram: IDiagram) => {
          return diagram.name === diagramName;
        });
      } else {
        this.activeDiagram = await this.activeSolutionEntry.service.loadDiagram(
          this.router.currentInstruction.params.diagramName,
        );
      }

      const diagramNotFound: boolean = this.activeDiagram === undefined;

      if (diagramNotFound) {
        return;
      }

      this.updateNavbarTitle();
    }

    this.updateNavbarTools();

    const routeNameIsStartPage: boolean = this.router.currentInstruction.config.name === 'start-page';
    if (routeNameIsStartPage) {
      this.resetNavbar();
    }
  }

  private resetNavbar(): void {
    this.activeDiagram = undefined;
    this.activeSolutionEntry = undefined;
    this.navbarTitle = '';
    this.showProcessName = false;
  }

  private closeDiagramOrStudioEventFunction: Function = (): void => {
    const noDiagramIsActive: boolean = this.activeDiagram === undefined;
    if (noDiagramIsActive) {
      this.ipcRenderer.send('close_bpmn-studio');
    }

    if (solutionIsRemoteSolution(this.activeSolutionEntry.uri)) {
      this.router.navigateToRoute('start-page');
    } else {
      this.eventAggregator.publish(environment.events.solutionExplorer.closeDiagram);
    }
  };

  private checkIfCurrentPlatformIsMac(): boolean {
    const macRegex: RegExp = /.*mac*./i;
    const currentPlatform: string = navigator.platform;
    const currentPlatformIsMac: boolean = macRegex.test(currentPlatform);

    return currentPlatformIsMac && isRunningInElectron();
  }
}
