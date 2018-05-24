import {inject} from 'aurelia-framework';

import {
  BpmnStudioClient,
  IPagination,
  IProcessDefEntity,
} from '@process-engine/bpmn-studio_client';
import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import { Router } from 'aurelia-router';
import {AuthenticationStateEvent} from '../../contracts/index';
import environment from '../../environment';

@inject('BpmnStudioClient', EventAggregator, Router)
export class ProcessSolutionPanel {
  private _bpmnStudioClient: BpmnStudioClient;
  private _subscriptions: Array<Subscription>;
  private _eventAggregator: EventAggregator;
  private _router: Router;

  public processes: IPagination<IProcessDefEntity>;

  constructor(bpmnStudioClient: BpmnStudioClient, eventAggregator: EventAggregator, router: Router) {
    this._bpmnStudioClient = bpmnStudioClient;
    this._eventAggregator = eventAggregator;
    this._router = router;
    this._refreshProcesslist();
  }

  public async attached(): Promise<void> {
    this._subscriptions = [
      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, () => {
        this._refreshProcesslist();
      }),
      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, () => {
        this._refreshProcesslist();
      }),
      this._eventAggregator.subscribe(environment.events.refreshProcessDefs, () => {
        this._refreshProcesslist();
      }),
    ];
  }

  private async _refreshProcesslist(): Promise<void> {
    this.processes = await this._bpmnStudioClient.getProcessDefList();
  }

  public detached(): void {
    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }
}
