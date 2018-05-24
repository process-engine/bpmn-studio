import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {RouteConfig, Router} from 'aurelia-router';
import {IProcessDefEntity} from '../../contracts';
import environment from '../../environment';

@inject(Router, EventAggregator)
export class NavBar {
  private _router: Router;
  private _eventAggregator: EventAggregator;

  @bindable() public showSolutionExplorer: boolean;
  public activeRouteTitle: string;
  public showTools: boolean = false;
  public disableSaveButton: boolean = false;
  public process: IProcessDefEntity;
  public exportButton: HTMLButtonElement;
  public exportSpinner: HTMLElement;
  public exportIcon: HTMLElement;

  private _lastProcess: IProcessDefEntity;

  constructor(router: Router, eventAggregator: EventAggregator) {
    this._router = router;
    this._eventAggregator = eventAggregator;
  }

  public attached(): void {
    this._dertermineActiveRoute();

    this._eventAggregator.subscribe('router:navigation:complete', () => {
      this._dertermineActiveRoute();
    });

    this._eventAggregator.subscribe(environment.events.navBar.showTools, (process: IProcessDefEntity) => {
      this.showTools = true;
      this._lastProcess = this.process;
      this.process = process;
    });

    this._eventAggregator.subscribe(environment.events.navBar.hideTools, () => {
      this.showTools = false;
    });

    this._eventAggregator.subscribe(environment.events.navBar.updateProcess, (process: IProcessDefEntity) => {
      this._lastProcess = this.process;
      this.process = process;
    });

    this._eventAggregator.subscribe(environment.events.navBar.disableSaveButton, () => {
      this.disableSaveButton = true;
    });

    this._eventAggregator.subscribe(environment.events.navBar.enableSaveButton, () => {
      this.disableSaveButton = false;
    });
  }

  public navigate(routeTitle: string): void {
    const route: RouteConfig = this._router.routes.find((r: RouteConfig) => {
      return r.title === routeTitle;
    });

    this._router.navigate(`/${route.route}`);
  }

  public navigateBack(): void {
    this._eventAggregator.publish(environment.events.navBar.updateProcess, this._lastProcess);
    this._router.navigateBack();
  }

  public toggleSolutionExplorer(): void {
    this.showSolutionExplorer = !this.showSolutionExplorer;
  }

  public saveDiagram(): void {
    if (!this.disableSaveButton) {
      this._eventAggregator.publish(environment.events.processDefDetail.saveDiagramm);
    }
  }

  public exportDiagram(exportAs: string): void {
    this._eventAggregator.publish(`${environment.events.processDefDetail.exportDiagramAs}:${exportAs}`);
  }

  public startProcess(): void {
    this._eventAggregator.publish(environment.events.processDefDetail.startProcess);
  }

  private _isRouteActive(routeTitle: string): boolean {
    if (this._router.currentInstruction.config.title === routeTitle) {
      return true;
    }
    return false;
  }

  private _dertermineActiveRoute(): void {
    this._router.routes.forEach((route: RouteConfig) => {
      if (this._isRouteActive(route.title)) {
        this.activeRouteTitle = route.title;
      }
    });
  }
}
