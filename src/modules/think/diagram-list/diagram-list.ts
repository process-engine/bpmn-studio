import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';

import {IIdentity} from '@essential-projects/iam_contracts';
import {AuthenticationStateEvent, ISolutionEntry} from '../../../contracts/index';
import environment from '../../../environment';
import {solutionIsRemoteSolution} from '../../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';
import {OpenDiagramsSolutionExplorerService} from '../../../services/solution-explorer-services/open-diagrams-solution-explorer.service';

@inject(EventAggregator, Router, 'OpenDiagramService')
export class DiagramList {
  public allDiagrams: Array<IDiagram>;
  @bindable() public activeSolutionEntry: ISolutionEntry;

  private eventAggregator: EventAggregator;
  private router: Router;
  private openDiagramService: OpenDiagramsSolutionExplorerService;
  private subscriptions: Array<Subscription>;
  private pollingTimeout: NodeJS.Timer;
  private isAttached: boolean = false;

  constructor(
    eventAggregator: EventAggregator,
    router: Router,
    openDiagramService: OpenDiagramsSolutionExplorerService,
  ) {
    this.eventAggregator = eventAggregator;
    this.router = router;
    this.openDiagramService = openDiagramService;
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

  public async openDiagram(diagram: IDiagram): Promise<void> {
    const diagramIsFromLocalSolution: boolean = !solutionIsRemoteSolution(diagram.uri);

    if (diagramIsFromLocalSolution) {
      const diagramIsNotYetOpened: boolean = !this.openDiagramService
        .getOpenedDiagrams()
        .some((openedDiagram: IDiagram): boolean => {
          return openedDiagram.uri === diagram.uri;
        });

      if (diagramIsNotYetOpened) {
        await this.openDiagramService.openDiagramFromSolution(diagram.uri, this.createIdentityForSolutionExplorer());
      }
    }

    this.router.navigateToRoute('design', {
      diagramName: diagram.name,
      diagramUri: diagram.uri,
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

  private createIdentityForSolutionExplorer(): IIdentity {
    const accessToken: string = this.createDummyAccessToken();
    const identity: IIdentity = {
      token: accessToken,
      userId: '',
    };

    return identity;
  }

  private createDummyAccessToken(): string {
    const dummyAccessTokenString: string = 'dummy_token';
    const base64EncodedString: string = btoa(dummyAccessTokenString);

    return base64EncodedString;
  }
}
