import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import environment from '../../environment';
import {isRunningInElectron} from '../../services/is-running-in-electron-module/is-running-in-electron.module';

@inject(EventAggregator)
export class StartPage {
  public isRunningOnWindows: boolean = false;
  public isRunningOnMacOS: boolean = false;

  private eventAggregator: EventAggregator;
  private ipcRenderer: any;

  constructor(eventAggregator: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(): void {
    if (isRunningInElectron()) {
      this.isRunningOnWindows = process.platform === 'win32';
      this.isRunningOnMacOS = process.platform === 'darwin';

      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
      this.ipcRenderer.on('menubar__start_close_diagram', this.closeBpmnStudio);
    }
  }

  public deactivate(): void {
    if (isRunningInElectron()) {
      this.ipcRenderer.removeListener('menubar__start_close_diagram', this.closeBpmnStudio);
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

  private closeBpmnStudio: Function = (): void => {
    this.ipcRenderer.send('close_bpmn-studio');
  };
}
