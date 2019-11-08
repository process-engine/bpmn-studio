import {bindable} from 'aurelia-framework';
import {ISolutionEntry} from '../../../contracts';
import {processEngineSupportsCronjobs} from '../../../services/process-engine-version-module/process-engine-version.module';

export class Dashboard {
  @bindable() public activeSolutionEntry: ISolutionEntry;
  public showCronjobList: boolean = false;

  public attached(): void {
    const processEngineVersion: string = this.activeSolutionEntry.processEngineVersion;
    const activeSolutionHasVersion: boolean = processEngineVersion !== undefined;

    this.showCronjobList = activeSolutionHasVersion ? processEngineSupportsCronjobs(processEngineVersion) : false;
  }

  public activeSolutionEntryChanged(): void {
    const processEngineVersion = this.activeSolutionEntry.processEngineVersion;
    const activeSolutionHasVersion: boolean = processEngineVersion !== undefined;

    this.showCronjobList = activeSolutionHasVersion ? processEngineSupportsCronjobs(processEngineVersion) : false;
  }
}
