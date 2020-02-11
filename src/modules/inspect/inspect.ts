import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {activationStrategy} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {ISolutionEntry, ISolutionService, InspectPanelTab, NotificationType} from '../../contracts/index';
import environment from '../../environment';
import {NotificationService} from '../../services/notification-service/notification.service';
import {Dashboard} from './dashboard/dashboard';
import {solutionIsRemoteSolution} from '../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';
import {isRunningInElectron} from '../../services/is-running-in-electron-module/is-running-in-electron.module';

interface IInspectRouteParameters {
  view?: string;
  diagramName?: string;
  solutionUri?: string;
  processInstanceToSelect?: string;
  flowNodeToSelect?: string;
  inspectPanelTabToShow?: InspectPanelTab;
}

@inject(EventAggregator, 'SolutionService', 'NotificationService')
export class Inspect {
  @bindable() public showDashboard: boolean = true;
  @bindable() public activeDiagram: IDiagram;
  @bindable() public activeSolutionEntry: ISolutionEntry;

  public showHeatmap: boolean = false;
  public showInspectProcessInstance: boolean = false;
  public dashboard: Dashboard;
  public showTokenViewer: boolean = false;
  public tokenViewerButtonDisabled: boolean = false;
  public processInstanceToSelect: string;
  public flowNodeToSelect: string;
  public inspectPanelTabToShow: InspectPanelTab;

  private eventAggregator: EventAggregator;
  private subscriptions: Array<Subscription>;
  private solutionService: ISolutionService;
  private notificationService: NotificationService;

  constructor(
    eventAggregator: EventAggregator,
    solutionService: ISolutionService,
    notificationService: NotificationService,
  ) {
    this.eventAggregator = eventAggregator;
    this.solutionService = solutionService;
    this.notificationService = notificationService;
  }

  public determineActivationStrategy(): string {
    return activationStrategy.invokeLifecycle;
  }

  public canActivate(routeParameters: IInspectRouteParameters): boolean {
    const solutionUri: string = routeParameters.solutionUri
      ? routeParameters.solutionUri
      : window.localStorage.getItem('InternalProcessEngineRoute');

    if (solutionUri === 'about:open-diagrams') {
      this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(
        window.localStorage.getItem('InternalProcessEngineRoute'),
      );

      return true;
    }

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(solutionUri);

    const noSolutionEntry: boolean = this.activeSolutionEntry === undefined;
    if (noSolutionEntry) {
      this.notificationService.showNotification(NotificationType.INFO, 'Please open a solution first.');

      return false;
    }

    return true;
  }

  public async activate(routeParameters: IInspectRouteParameters): Promise<void> {
    const solutionUri: string = routeParameters.solutionUri;
    const diagramName: string = routeParameters.diagramName;

    await this.updateInspectView(diagramName, solutionUri);

    const routeViewIsDashboard: boolean = routeParameters.view === 'dashboard';
    const routeViewIsHeatmap: boolean = routeParameters.view === 'heatmap';
    const routeViewIsInspectProcessInstance: boolean = routeParameters.view === 'inspect-process-instance';

    this.processInstanceToSelect = routeParameters.processInstanceToSelect;
    this.flowNodeToSelect = routeParameters.flowNodeToSelect;
    this.inspectPanelTabToShow = routeParameters.inspectPanelTabToShow;

    if (routeViewIsDashboard) {
      this.showHeatmap = false;
      this.showDashboard = true;
      this.showInspectProcessInstance = false;

      this.eventAggregator.publish(environment.events.navBar.toggleDashboardView);
    } else if (routeViewIsHeatmap) {
      this.eventAggregator.publish(environment.events.navBar.toggleHeatmapView);

      this.showDashboard = false;
      this.showHeatmap = true;
      this.showInspectProcessInstance = false;
    } else if (routeViewIsInspectProcessInstance) {
      this.eventAggregator.publish(environment.events.navBar.toggleInspectProcessInstanceView);

      this.showDashboard = false;
      this.showHeatmap = false;
      this.showInspectProcessInstance = true;
    }
  }

  public attached(): void {
    this.subscriptions = [
      this.eventAggregator.subscribe(
        environment.events.inspect.shouldDisableTokenViewerButton,
        (tokenViewerButtonDisabled: boolean) => {
          this.tokenViewerButtonDisabled = tokenViewerButtonDisabled;
        },
      ),
    ];

    const previousTokenViewerState: boolean = JSON.parse(
      window.localStorage.getItem('tokenViewerInspectCollapseState'),
    );
    this.showTokenViewer = previousTokenViewerState || false;
  }

  public detached(): void {
    this.eventAggregator.publish(environment.events.navBar.inspectNavigateToDashboard);

    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public toggleShowTokenViewer(): void {
    if (this.tokenViewerButtonDisabled) {
      return;
    }

    this.showTokenViewer = !this.showTokenViewer;

    this.eventAggregator.publish(environment.events.inspectProcessInstance.showTokenViewer, this.showTokenViewer);
    window.localStorage.setItem('tokenViewerInspectCollapseState', JSON.stringify(this.showTokenViewer));
  }

  private async updateInspectView(diagramName: string, solutionUri?: string): Promise<void> {
    const solutionUriIsSet: boolean = solutionUri !== undefined;

    const solutionUriToUse: string = solutionUriIsSet
      ? solutionUri
      : window.localStorage.getItem('InternalProcessEngineRoute');

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(solutionUriToUse);
    await this.activeSolutionEntry.service.openSolution(
      this.activeSolutionEntry.uri,
      this.activeSolutionEntry.identity,
    );

    const solutionIsRemote: boolean = solutionIsRemoteSolution(solutionUriToUse);
    if (solutionIsRemote) {
      this.eventAggregator.publish(
        environment.events.configPanel.solutionEntryChanged,
        this.solutionService.getSolutionEntryForUri(solutionUriToUse),
      );
    }

    const diagramIsSet: boolean = diagramName !== undefined;
    if (diagramIsSet) {
      let newActiveDiagram: IDiagram;

      const activeSolutionIsOpenSolution: boolean = solutionUriToUse === 'about:open-diagrams';
      if (activeSolutionIsOpenSolution) {
        const persistedDiagrams: Array<IDiagram> = this.solutionService.getOpenDiagrams();

        newActiveDiagram = persistedDiagrams.find((diagram: IDiagram) => {
          return diagram.name === diagramName;
        });
      } else {
        try {
          newActiveDiagram = await this.activeSolutionEntry.service.loadDiagram(diagramName);
        } catch {
          // If loading the diagram failed, do nothing
        }
      }

      const activeDiagramChanged: boolean = this.activeDiagram?.uri !== newActiveDiagram.uri;
      if (activeDiagramChanged) {
        this.activeDiagram = newActiveDiagram;
      }
    }
  }
}
