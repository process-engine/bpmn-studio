import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import environment from '../../environment';
import {isRunningInElectron} from '../../services/is-running-in-electron-module/is-running-in-electron.module';

@inject(EventAggregator)
export class StartPage {
  public isRunningOnWindows: boolean = false;
  public isRunningOnMacOS: boolean = false;

  private eventAggregator: EventAggregator;

  constructor(eventAggregator: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(): void {
    if (isRunningInElectron()) {
      this.isRunningOnWindows = process.platform === 'win32';
      this.isRunningOnMacOS = process.platform === 'darwin';
    }
  }

  public get showShortcuts(): boolean {
    return isRunningInElectron();
  }

  public openLocalSolution(): void {
    this.eventAggregator.publish(environment.events.startPage.openLocalSolution);
  }

  public openDiagram(): void {
    this.eventAggregator.publish(environment.events.startPage.openDiagram);
  }

  public createNewDiagram(): void {
    this.eventAggregator.publish(environment.events.startPage.createDiagram);
  }
}
