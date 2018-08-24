import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {RouteConfig, Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IEventFunction} from '../../contracts';
import environment from '../../environment';

@inject(Router, EventAggregator)
export class NavBar {

  @bindable() public activeRouteName: string;
  public process: IDiagram;
  public diagramInfo: HTMLElement;
  public dropdown: HTMLElement;
  public solutionExplorerIsActive: boolean = true;
  public showTools: boolean = false;
  public disableStartButton: boolean = true;
  public disableSaveButton: boolean = false;
  public disableDiagramUploadButton: boolean = true;
  public diagramContainsUnsavedChanges: boolean = false;

  private _router: Router;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;

  constructor(router: Router, eventAggregator: EventAggregator) {
    this._router = router;
    this._eventAggregator = eventAggregator;
  }

  public attached(): void {
    this._dertermineActiveRoute();

    this.solutionExplorerIsActive = window.localStorage.getItem('SolutionExplorerVisibility') === 'true';

    document.addEventListener('click', this.dropdownClickListener);

    this._subscriptions = [
      this._eventAggregator.subscribe('router:navigation:complete', () => {
        this._dertermineActiveRoute();
      }),

      this._eventAggregator.subscribe(environment.events.navBar.showTools, (process: IDiagram) => {
        this.showTools = true;
        this.process = process;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.hideTools, () => {
        this.showTools = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.updateProcess, (process: IDiagram) => {
        this.process = process;
        this.diagramContainsUnsavedChanges = false;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.disableSaveButton, () => {
        this.disableSaveButton = true;
      }),

      this._eventAggregator.subscribe(environment.events.navBar.enableSaveButton, () => {
        this.disableSaveButton = false;
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
    ];
  }

  public detached(): void {
    document.removeEventListener('click', this.dropdownClickListener);

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

  public navigateToInspect(): void {
    this._router.navigateToRoute('inspect', {processModelId: this.process.id});
  }

  public toggleSolutionExplorer(): void {
    this.solutionExplorerIsActive = !this.solutionExplorerIsActive;
    this._eventAggregator.publish(environment.events.processSolutionPanel.toggleProcessSolutionExplorer);
  }

  public saveDiagram(): void {
    if (!this.disableSaveButton) {
      this._eventAggregator.publish(environment.events.processDefDetail.saveDiagram);
    }
  }

  public printDiagram(): void {
    this._eventAggregator.publish(environment.events.processDefDetail.printDiagram);
  }

  public exportDiagram(exportAs: string): void {
    this._eventAggregator.publish(`${environment.events.processDefDetail.exportDiagramAs}:${exportAs}`);
  }

  public startProcess(): void {
    this._eventAggregator.publish(environment.events.processDefDetail.startProcess);
  }

  public uploadProcess(): void {
    this._eventAggregator.publish(environment.events.processDefDetail.uploadProcess);
  }

  /**
   * Checks if the user clicked inside of the dropdown, to prevent it from
   * closing in that case.
   *
   * @param event: Mouse event
   */
  public dropdownClickListener: IEventFunction =  (event: MouseEvent): void => {
    const eventTarget: Node = event.target as Node;

    const hasNavbarNoPreviousDropdown: boolean = this.dropdown === undefined || this.dropdown === null;

    if (hasNavbarNoPreviousDropdown) {
      return;
    }

    const dropdownWasClicked: boolean = this.dropdown.contains(eventTarget);
    if (dropdownWasClicked) {
      this.diagramInfo.className += ' open';
    }
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
