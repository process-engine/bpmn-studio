import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {activationStrategy} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {ISolutionEntry, ISolutionService, NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';
import {SingleDiagramsSolutionExplorerService} from '../../services/solution-explorer-services/SingleDiagramsSolutionExplorerService';
import {Dashboard} from './dashboard/dashboard';

interface IInspectRouteParameters {
  view?: string;
  diagramName?: string;
  solutionUri?: string;
}

@inject(EventAggregator, 'SolutionService', 'NotificationService')
export class Inspect {

  @bindable() public showDashboard: boolean = true;
  @bindable() public activeDiagram: IDiagram;
  @bindable() public activeSolutionEntry: ISolutionEntry;

  public showHeatmap: boolean = false;
  public showInspectCorrelation: boolean = false;
  public dashboard: Dashboard;
  public showTokenViewer: boolean = false;
  public tokenViewerButtonDisabled: boolean = false;

  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;
  private _solutionService: ISolutionService;
  private _notificationService: NotificationService;

  constructor(eventAggregator: EventAggregator,
              solutionService: ISolutionService,
              notificationService: NotificationService) {
    this._eventAggregator = eventAggregator;
    this._solutionService = solutionService;
    this._notificationService = notificationService;
  }

  public determineActivationStrategy(): string {
    return activationStrategy.invokeLifecycle;
 }

  public canActivate(routeParameters: IInspectRouteParameters): boolean {
    const solutionUri: string = routeParameters.solutionUri
                              ? routeParameters.solutionUri
                              : window.localStorage.getItem('InternalProcessEngineRoute');

    this.activeSolutionEntry = this._solutionService.getSolutionEntryForUri(solutionUri);

    const noSolutionEntry: boolean = this.activeSolutionEntry === undefined;
    if (noSolutionEntry) {
      this._notificationService.showNotification(NotificationType.INFO, 'Please open a solution first.');

      return false;
    }

    return true;
  }

  public async activate(routeParameters: IInspectRouteParameters): Promise<void> {
    const solutionUri: string = routeParameters.solutionUri;
    const diagramName: string = routeParameters.diagramName;

    await this._updateInspectView(diagramName, solutionUri);

    const routeViewIsDashboard: boolean = routeParameters.view === 'dashboard';
    const routeViewIsHeatmap: boolean = routeParameters.view === 'heatmap';
    const routeViewIsInspectCorrelation: boolean = routeParameters.view === 'inspect-correlation';

    if (routeViewIsDashboard) {
      this.showHeatmap = false;
      this.showDashboard = true;
      this.showInspectCorrelation = false;

      setTimeout(() => {
        const dashboardIsAttached: boolean = this.dashboard !== undefined;

        if (dashboardIsAttached) {
          this.dashboard.canActivate(this.activeSolutionEntry);
        }
      }, 0);

      this._eventAggregator.publish(environment.events.navBar.toggleDashboardView);
    } else if (routeViewIsHeatmap) {
      this._eventAggregator.publish(environment.events.navBar.toggleHeatmapView);

      this.showDashboard = false;
      this.showHeatmap = true;
      this.showInspectCorrelation = false;
    } else if (routeViewIsInspectCorrelation) {
      this._eventAggregator.publish(environment.events.navBar.toggleInspectCorrelationView);

      this.showDashboard = false;
      this.showHeatmap = false;
      this.showInspectCorrelation = true;
    }
  }

  public attached(): void {
    const dashboardIsAttached: boolean = this.dashboard !== undefined;

    if (dashboardIsAttached) {
      this.dashboard.canActivate(this.activeSolutionEntry);
    }

    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.inspect.shouldDisableTokenViewerButton, (tokenViewerButtonDisabled: boolean) => {
        this.tokenViewerButtonDisabled = tokenViewerButtonDisabled;
      }),
    ];
  }

  public detached(): void {
    this._eventAggregator.publish(environment.events.navBar.inspectNavigateToDashboard);

    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }

  public toggleShowTokenViewer(): void {
    if (this.tokenViewerButtonDisabled) {
      return;
    }

    this.showTokenViewer = !this.showTokenViewer;

    this._eventAggregator.publish(environment.events.inspectCorrelation.showTokenViewer, this.showTokenViewer);
  }

  private async _updateInspectView(diagramName: string, solutionUri: string): Promise<void> {
    const solutionUriIsNotSet: boolean = solutionUri === undefined;
    if (solutionUriIsNotSet) {
      solutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    this.activeSolutionEntry = this._solutionService.getSolutionEntryForUri(solutionUri);
    await this.activeSolutionEntry.service.openSolution(this.activeSolutionEntry.uri, this.activeSolutionEntry.identity);

    const solutionIsRemote: boolean = solutionUri.startsWith('http');
    if (solutionIsRemote) {
      this._eventAggregator.publish(environment.events.configPanel.processEngineRouteChanged, solutionUri);
    }

    const diagramIsSet: boolean = diagramName !== undefined;
    if (diagramIsSet) {

      if (this.activeSolutionEntry.isSingleDiagramService) {
        const persistedDiagrams: Array<IDiagram> = this._solutionService.getSingleDiagrams();

        this.activeDiagram = persistedDiagrams.find((diagram: IDiagram) => {
          return diagram.name === diagramName;
        });

        /**
         * This If gets called when the activeDiagram is not found within the localStorage.
         * This can happen if the diagram to open is a temporary diagram.
         *
         * Temporary diagrams are not persisted in localStorage.
         */
        const noActiveDiagram: boolean = this.activeDiagram === undefined;
        if (noActiveDiagram) {
          const service: SingleDiagramsSolutionExplorerService = this.activeSolutionEntry.service as SingleDiagramsSolutionExplorerService;
          const allOpenedSingleDiagrams: Array<IDiagram> = service.getOpenedDiagrams();

          this.activeDiagram = allOpenedSingleDiagrams.find((diagram: IDiagram) => {
            return diagram.name === diagramName
                && diagram.uri.includes('temp-diagrams');
          });
        }
      } else {

        this.activeDiagram = await this.activeSolutionEntry.service.loadDiagram(diagramName);
      }
    }
  }

}
