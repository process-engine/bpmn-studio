import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';

import {AuthenticationStateEvent, ISolutionEntry} from '../../../contracts/index';
import environment from '../../../environment';

@inject(EventAggregator, Router)
export class DiagramList {
  public allDiagrams: Array<IDiagram>;
  @bindable() public activeSolutionEntry: ISolutionEntry;

  private eventAggregator: EventAggregator;
  private router: Router;
  private subscriptions: Array<Subscription>;
  private pollingTimeout: NodeJS.Timer;
  private isAttached: boolean = false;

  constructor(eventAggregator: EventAggregator, router: Router) {
    this.eventAggregator = eventAggregator;
    this.router = router;
  }

  public async attached(): Promise<void> {
    this.isAttached = true;

    await this.updateDiagramList();
    this.startPolling();

    this.subscriptions = [
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, () => {
        this.updateDiagramList();
      }),
    ];
  }

  public detached(): void {
    this.isAttached = false;

    this.stopPolling();

    if (this.subscriptions !== undefined) {
      for (const subscription of this.subscriptions) {
        subscription.dispose();
      }
    }
  }

  private startPolling(): void {
    this.pollingTimeout = setTimeout(async () => {
      await this.updateDiagramList();

      if (this.isAttached) {
        this.startPolling();
      }
    }, environment.processengine.processDefListPollingIntervalInMs);
  }

  private stopPolling(): void {
    clearTimeout(this.pollingTimeout);
  }

  public showDetails(diagramName: string): void {
    this.router.navigateToRoute('design', {
      diagramName: diagramName,
      solutionUri: this.activeSolutionEntry.uri,
      view: 'detail',
    });
  }

  private async updateDiagramList(): Promise<void> {
    try {
      const solution: ISolution = await this.activeSolutionEntry.service.loadSolution();
      this.allDiagrams = solution.diagrams;
    } catch (error) {
      // Do nothing
    }
  }
}
