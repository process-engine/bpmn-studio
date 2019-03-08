import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, computedFrom, inject} from 'aurelia-framework';
import {NavModel, Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {ISolutionEntry, ISolutionService, NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';
import {SingleDiagramsSolutionExplorerService} from '../../services/solution-explorer-services/SingleDiagramsSolutionExplorerService';

@inject(Router, EventAggregator, 'NotificationService', 'SolutionService')
export class NavBar {

  public activeSolutionEntry: ISolutionEntry;
  public activeDiagram: IDiagram;

  public diagramInfo: HTMLElement;
  public dropdown: HTMLElement;
  public solutionExplorerIsActive: boolean = true;
  public showTools: boolean = false;
  public showInspectTools: boolean = false;
  public showExportOnInspectCorrelation: boolean = false;
  public disableStartButton: boolean = true;
  public validationError: boolean = false;
  public showProcessName: boolean = false;
  public disableDiagramUploadButton: boolean = true;
  public disableHeatmapButton: boolean = true;
  public disableDashboardButton: boolean = false;
  public disableInspectCorrelationButton: boolean = false;
  public diagramContainsUnsavedChanges: boolean = false;
  public savingTargetIsRemoteSolution: boolean = false;

  public inspectView: string = 'dashboard';
  public designView: string = 'detail';
  public thinkView: string = 'diagram-list';

  public navbarTitle: string = '';
  @bindable() public processOpenedFromProcessEngine: boolean = false;

  public router: Router;

  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;
  private _notificationService: NotificationService;
  private _solutionService: ISolutionService;

  constructor(router: Router, eventAggregator: EventAggregator, notificationService: NotificationService, solutionService: ISolutionService) {
    this.router = router;
    this._eventAggregator = eventAggregator;
    this._notificationService = notificationService;
    this._solutionService = solutionService;
  }

  public attached(): void {

    this.solutionExplorerIsActive = window.localStorage.getItem('SolutionExplorerVisibility') === 'true';

    this._updateNavbar();

    this._subscriptions = [
      this._eventAggregator.subscribe('router:navigation:success', () => {
        this._updateNavbar();
      }),

      this._eventAggregator.subscribe(environment.events.navBar.showTools, () => {
        this.showTools = true;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.hideTools, () => {
        this.showTools = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.validationError, () => {
        this.validationError = true;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.noValidationError, () => {
        this.validationError = false;
      }),

      this._eventAggregator.subscribe(environment.events.differsFromOriginal, (isDiagramChanged: boolean) => {
        this.diagramContainsUnsavedChanges = isDiagramChanged;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.diagramChangesResolved, () => {
        this.diagramContainsUnsavedChanges = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.inspectNavigateToDashboard, () => {
        this.inspectView = 'dashboard';
      }),

      this._eventAggregator.subscribe(environment.events.navBar.toggleHeatmapView, () => {
        this.disableHeatmapButton = true;
        this.disableDashboardButton = false;
        this.disableInspectCorrelationButton = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.toggleDashboardView, () => {
        this.disableHeatmapButton = false;
        this.disableDashboardButton = true;
        this.disableInspectCorrelationButton = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.toggleInspectCorrelationView, () => {
        this.disableHeatmapButton = false;
        this.disableDashboardButton = false;
        this.disableInspectCorrelationButton = true;
      }),
    ];
  }

  public detached(): void {
    this._disposeAllSubscriptions();
  }

  @computedFrom('processOpenedFromProcessEngine')
  public get getClassNameForNavbarIcon(): string {
    const iconClassName: string = ((): string => {
      if (this.processOpenedFromProcessEngine) {
        return 'fa-database';
      } else {
        return 'fa-folder';
      }
    })();
    return iconClassName;
  }

  private _disposeAllSubscriptions(): void {
    this._subscriptions.forEach((subscription: Subscription) => {
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
        const noActiveDiagram: boolean = this.activeDiagram === undefined;
        if (noActiveDiagram) {
          this._notificationService.showNotification(NotificationType.INFO, 'In order to open the designer, you have to select a diagram first!');

          return;
        }

        const designIsActive: boolean = navModel.isActive === true;
        if (designIsActive) {
          return;
        }

        this.routerNavigate(navModel.config.name, this.designView);

        break;
      case 'inspect':
        const inspectIsActive: boolean = navModel.isActive === true;
        if (inspectIsActive) {
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
    this.disableInspectCorrelationButton = false;

    this.inspectView = 'dashboard';

    this.routerNavigate(this.router.currentInstruction.config.name, this.inspectView);
  }

  public showHeatmap(): void {
    this.disableHeatmapButton = true;
    this.disableDashboardButton = false;
    this.disableInspectCorrelationButton = false;

    this.inspectView = 'heatmap';

    this.routerNavigate(this.router.currentInstruction.config.name, this.inspectView);
  }

  public showInspectCorrelation(): void {
    this.disableHeatmapButton = false;
    this.disableDashboardButton = false;
    this.disableInspectCorrelationButton = true;

    this.inspectView = 'inspect-correlation';

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
    this._eventAggregator.publish(environment.events.processSolutionPanel.toggleProcessSolutionExplorer);
  }

  public saveDiagram(): void {
    if (this.validationError && this.savingTargetIsRemoteSolution) {
      return;
    }

    this._eventAggregator.publish(environment.events.diagramDetail.saveDiagram);
  }

  public printDiagram(): void {

    this._eventAggregator.publish(environment.events.diagramDetail.printDiagram);
  }

  public exportDiagram(exportAs: string): void {
    const eventToPublish: string = this.showExportOnInspectCorrelation
                                 ? environment.events.inspect.exportDiagramAs
                                 : environment.events.diagramDetail.exportDiagramAs;

    this._eventAggregator.publish(`${eventToPublish}:${exportAs}`);
  }

  public startProcess(): void {
    if (this.validationError || this.disableStartButton) {
      return;
    }

    this._eventAggregator.publish(environment.events.diagramDetail.startProcess);
  }

  public startProcessWithOptions(): void {
    if (this.validationError || this.disableStartButton) {
      return;
    }

    this._eventAggregator.publish(environment.events.diagramDetail.startProcessWithOptions);
  }

  public uploadProcess(): void {
    if (this.validationError || this.disableDiagramUploadButton) {
      return;
    }

    this._eventAggregator.publish(environment.events.diagramDetail.uploadProcess);
  }

  /**
   * Updates the title of the navbar including the navbar icon which
   * indicates, if the process was opened from the local filesystem
   * or a remote ProcessEngine
   */
  private _updateNavbarTitle(): void {
    const noActiveDiagram: boolean = this.router.currentInstruction.params.diagramName === undefined;

    if (noActiveDiagram) {
      this.showProcessName = false;
      this.navbarTitle = '';

      return;
    }

    const activeSolutionIsRemoteSolution: boolean = this.activeSolutionEntry.uri.startsWith('http');
    this.showProcessName = this.activeDiagram.name !== undefined;

    this.navbarTitle = activeSolutionIsRemoteSolution ? this.activeDiagram.id : this.activeDiagram.name;

    this.processOpenedFromProcessEngine = activeSolutionIsRemoteSolution;
  }

  private _updateNavbarTools(): void {
    const activeRoute: string = this.router.currentInstruction.config.name;

    const activeSolutionIsRemoteSolution: boolean = this.activeSolutionEntry.uri.startsWith('http') && this.activeDiagram !== undefined;
    const activeRouteIsDiagramDetail: boolean = activeRoute === 'design';
    const activeRouteIsInspect: boolean = activeRoute === 'inspect';
    const activeRouteIsLET: boolean = activeRoute === 'live-execution-tracker';

    this.disableStartButton = !activeSolutionIsRemoteSolution;
    this.disableDiagramUploadButton = activeSolutionIsRemoteSolution;

    if (activeRouteIsDiagramDetail) {
      this.showTools = true;
      this.showInspectTools = false;
      this.showExportOnInspectCorrelation = false;

    } else if (activeRouteIsInspect) {
      const inspectView: string = this.router.currentInstruction.params.view;
      const inspectViewIsDashboard: boolean = inspectView === 'dashboard';
      const inspectViewIsHeatmap: boolean = inspectView === 'heatmap';
      const inspectViewIsInspectCorrelation: boolean = inspectView === 'inspect-correlation';
      if (activeSolutionIsRemoteSolution) {
        this.showInspectTools = true;

        this.disableDashboardButton = inspectViewIsDashboard;
        this.disableHeatmapButton = inspectViewIsHeatmap;
        this.disableInspectCorrelationButton = inspectViewIsInspectCorrelation;

        this.showExportOnInspectCorrelation = inspectViewIsInspectCorrelation ? inspectViewIsInspectCorrelation : false;
      } else {
        this.showInspectTools = false;
      }

      this.showTools = false;
    } else if (activeRouteIsLET) {
      this.showTools = false;
      this.showInspectTools = false;
      this.showExportOnInspectCorrelation = false;
    }

  }

  private async _updateNavbar(): Promise<void> {

    const solutionUriFromNavigation: string = this.router.currentInstruction.queryParams.solutionUri;
    const noSolutionUriSpecified: boolean = solutionUriFromNavigation === undefined;

    const solutionUri: string = (noSolutionUriSpecified)
      ? window.localStorage.getItem('InternalProcessEngineRoute')
      : solutionUriFromNavigation;

    this.activeSolutionEntry = this._solutionService.getSolutionEntryForUri(solutionUri);

    const activeSolutionIsUndefined: boolean = this.activeSolutionEntry === undefined;
    if (activeSolutionIsUndefined) {
      return;
    }

    this.savingTargetIsRemoteSolution = this.activeSolutionEntry.uri.startsWith('http');

    const solutionIsSet: boolean = this.activeSolutionEntry !== undefined;
    const diagramName: string = this.router.currentInstruction.params.diagramName;
    const diagramIsSet: boolean = diagramName !== undefined;

    if (solutionIsSet && diagramIsSet) {

      if (this.activeSolutionEntry.isSingleDiagramService) {
        const persistedDiagrams: Array<IDiagram> = this._solutionService.getSingleDiagrams();

        this.activeDiagram = persistedDiagrams.find((diagram: IDiagram) => {
          return diagram.name === diagramName;
        });

        /**
         * This If gets called when the activeDiagram is not found within the localStorage.
         * This can happen if the diagram to open is a temporarily diagram.
         *
         * Temporarily diagrams are not persisted in localStorage.
         */
        if (!this.activeDiagram) {
          const service: SingleDiagramsSolutionExplorerService = this.activeSolutionEntry.service as SingleDiagramsSolutionExplorerService;
          const allOpenedSingleDiagrams: Array<IDiagram> = service.getOpenedDiagrams();

          this.activeDiagram = allOpenedSingleDiagrams.find((diagram: IDiagram) => {
            return diagram.name === diagramName
                && diagram.uri.includes('temp-diagrams');
          });
        }
      } else {

        this.activeDiagram = await this.activeSolutionEntry
          .service
          .loadDiagram(this.router.currentInstruction.params.diagramName);
      }

      const diagramNotFound: boolean = this.activeDiagram === undefined;

      if (diagramNotFound) {
        return;
      }

      this._updateNavbarTitle();
      this._updateNavbarTools();
    }

    const routeNameIsStartPage: boolean = this.router.currentInstruction.config.name === 'start-page';
    if (routeNameIsStartPage) {
      this._resetNavbar();
    }

  }

  private _resetNavbar(): void {
    this.activeDiagram = undefined;
    this.activeSolutionEntry = undefined;
    this.navbarTitle = '';
    this.showProcessName = false;
  }

}
