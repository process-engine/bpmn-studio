import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {RouteConfig, Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IEventFunction, NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../notification/notification.service';

@inject(Router, EventAggregator, 'NotificationService')
export class NavBar {

  @bindable() public activeRouteName: string;
  public process: IDiagram;
  public diagramInfo: HTMLElement;
  public dropdown: HTMLElement;
  public solutionExplorerIsActive: boolean = true;
  public showTools: boolean = false;
  public showInspectTools: boolean = false;
  public disableStartButton: boolean = true;
  public validationError: boolean = false;
  public showProcessName: boolean = false;
  public disableDiagramUploadButton: boolean = true;
  public disableHeatmapButton: boolean = true;
  public disableDashboardButton: boolean = false;
  public diagramContainsUnsavedChanges: boolean = false;
  public inspectView: string = 'dashboard';
  public disableDesignLink: boolean = false;
  public latestSource: string;
  public processOpenedFromProcessEngine: boolean = false;

  private _router: Router;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;
  private _notificationService: NotificationService;

  constructor(router: Router, eventAggregator: EventAggregator, notificationService: NotificationService) {
    this._router = router;
    this._eventAggregator = eventAggregator;
    this._notificationService = notificationService;
  }

  public attached(): void {
    this._dertermineActiveRoute();

    this.solutionExplorerIsActive = window.localStorage.getItem('SolutionExplorerVisibility') === 'true';

    this._subscriptions = [
      this._eventAggregator.subscribe('router:navigation:complete', () => {
        this._dertermineActiveRoute();
      }),

      this._eventAggregator.subscribe(environment.events.navBar.showTools, (process: IDiagram) => {
        this.showTools = true;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.showProcessName, (process: IDiagram) => {
        this.showProcessName = true;
        this.process = process;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.hideTools, () => {
        this.showTools = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.updateProcess, (process: IDiagram) => {
        const processIdIsUndefined: boolean = process.id === undefined;

        this.process = process;
        this.latestSource = processIdIsUndefined ? 'file-system' : 'process-engine';
        this.diagramContainsUnsavedChanges = false;

        /**
         * For some reason, the uri of the process is undefiend if the
         * process is opened from the ProcessEngine.
         * TODO: If this gets fixed, we have to check, if the uri starts
         * with http in to check, if the diagram was opened from a
         * connected ProcessEngine.
         */
        this.processOpenedFromProcessEngine = (process.uri === undefined);
      }),

      this._eventAggregator.subscribe(environment.events.navBar.hideProcessName, () => {
        this.showProcessName = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.validationError, () => {
        this.validationError = true;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.noValidationError, () => {
        this.validationError = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.disableStartButton, () => {
        this.disableStartButton = true;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.enableStartButton, () => {
        this.disableStartButton = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.disableDiagramUploadButton, () => {
        this.disableDiagramUploadButton = true;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.enableDiagramUploadButton, () => {
        this.disableDiagramUploadButton = false;
      }),

      this._eventAggregator.subscribe(environment.events.differsFromOriginal, (isDiagramChanged: boolean) => {
        this.diagramContainsUnsavedChanges = isDiagramChanged;
      }),

      this._eventAggregator.subscribe(environment.events.processDefDetail.saveDiagram, () => {
        this.diagramContainsUnsavedChanges = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.inspectNavigateToHeatmap, () => {
        this.inspectView = 'heatmap';
      }),

      this._eventAggregator.subscribe(environment.events.navBar.inspectNavigateToDashboard, () => {
        this.inspectView = 'dashboard';
      }),

      this._eventAggregator.subscribe(environment.events.navBar.showInspectButtons, () => {
        this.showInspectTools = true;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.hideInspectButtons, () => {
        this.showInspectTools = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.disableHeatmapAndEnableDashboardButton, () => {
        this.disableHeatmapButton = true;
        this.disableDashboardButton = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.disableDashboardAndEnableHeatmapButton, () => {
        this.disableHeatmapButton = false;
        this.disableDashboardButton = true;
      }),
      this._eventAggregator.subscribe(environment.events.navBar.setProcessEngineIcon, (processEngineIconShown: boolean) => {
        this.processOpenedFromProcessEngine = processEngineIconShown;
      }),
    ];
  }

  public detached(): void {
    this._disposeAllSubscriptions();
  }

  private _disposeAllSubscriptions(): void {
    this._subscriptions.forEach((subscription: Subscription) => {
      subscription.dispose();
    });
  }

  public navigateBack(): void {
    this._router.navigateBack();
  }

  public showDashboard(): void {
    this.disableDashboardButton = true;
    this.disableHeatmapButton = false;

    this._router.navigateToRoute('inspect', {
      processModelId: this.process.id,
      view: 'dashboard',
      latestSource: this.latestSource,
    });

    this._eventAggregator.publish(environment.events.processSolutionPanel.navigateToHeatmap, 'dashboard');
  }

  public showHeatmap(): void {
    this.disableHeatmapButton = true;
    this.disableDashboardButton = false;

    this._router.navigateToRoute('inspect', {
      processModelId: this.process.id,
      view: 'heatmap',
      latestSource: this.latestSource,
    });

    this._eventAggregator.publish(environment.events.processSolutionPanel.navigateToHeatmap, 'heatmap');
  }

  public navigateToInspect(): void {
    this._dertermineActiveRoute();

    const activeRouteIsInspect: boolean = this.activeRouteName === 'inspect';

    if (activeRouteIsInspect) {
      return;
    }

    const activeRouteIsNotProcessEngineRoute: boolean = this.activeRouteName !== 'processdef-detail';

    const processModelId: string = (this.process && !activeRouteIsNotProcessEngineRoute)
                                  ? this.process.id
                                  : undefined;

    if (activeRouteIsNotProcessEngineRoute) {
      this.showInspectTools = false;
      this.showProcessName = false;
    }

    this._router.navigateToRoute('inspect', {
      processModelId: processModelId,
      view: this.inspectView,
      latestSource: undefined,
    });
  }

  public navigateToDesigner(): void {
    const processIsUndefined: boolean = this.process === undefined;
    const latestSourceIsPE: boolean = this.latestSource === 'process-engine';
    const latestSourceIsFS: boolean = this.latestSource === 'file-system';

    if (processIsUndefined) {
      this._notificationService.showNotification(NotificationType.INFO, 'In order to open the designer, you have to select a diagram first!');

      return;
    }

    if (latestSourceIsPE) {
      this._router.navigateToRoute('processdef-detail', {
        processModelId: this.process.id,
      });
    } else if (latestSourceIsFS) {
      this._router.navigateToRoute('diagram-detail', {
        diagramUri: this.process.uri,
      });
    }

  }

  public toggleSolutionExplorer(): void {
    this.solutionExplorerIsActive = !this.solutionExplorerIsActive;
    this._eventAggregator.publish(environment.events.processSolutionPanel.toggleProcessSolutionExplorer);
  }

  public saveDiagram(): void {
    if (this.validationError) {
      return;
    }

    this._eventAggregator.publish(environment.events.processDefDetail.saveDiagram);
  }

  public printDiagram(): void {
    if (this.validationError) {
      return;
    }

    this._eventAggregator.publish(environment.events.processDefDetail.printDiagram);
  }

  public exportDiagram(exportAs: string): void {
    if (this.validationError) {
      return;
    }

    this._eventAggregator.publish(`${environment.events.processDefDetail.exportDiagramAs}:${exportAs}`);
  }

  public startProcess(): void {
    if (this.validationError) {
      return;
    }

    this._eventAggregator.publish(environment.events.processDefDetail.startProcess);
  }

  public uploadProcess(): void {
    if (this.validationError) {
      return;
    }

    this._eventAggregator.publish(environment.events.processDefDetail.uploadProcess);
  }

  private _isRouteActive(routeName: string): boolean {
    if (this._router.currentInstruction.config.name === routeName) {
      return true;
    }
    return false;
  }

  private _dertermineActiveRoute(): void {
    const activeRoute: RouteConfig = this._router.routes.find((route: RouteConfig) => {
      return this._isRouteActive(route.name);
    });
    this.activeRouteName = activeRoute.name;
  }
}
