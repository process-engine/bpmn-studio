import {bindable} from 'aurelia-framework';

import {ISolutionEntry} from '../../../contracts';

import {processEngineSupportsCronjobs} from '../../../services/process-engine-version-module/process-engine-version.module';
import {solutionIsRemoteSolution} from '../../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';

export class Dashboard {
  @bindable() public activeSolutionEntry: ISolutionEntry;
  public showCronjobList: boolean = false;

  public attached(): void {
    const isRemoteSolution: boolean = solutionIsRemoteSolution(this.activeSolutionEntry.uri);
    const internalProcessEngineVersion: string = localStorage.getItem('InternalProcessEngineVersion');

    const processEngineVersion: string = isRemoteSolution
      ? this.activeSolutionEntry.processEngineVersion
      : internalProcessEngineVersion;
    const activeSolutionHasVersion: boolean = processEngineVersion !== undefined;

    this.showCronjobList = activeSolutionHasVersion ? processEngineSupportsCronjobs(processEngineVersion) : false;
  }

  public activeSolutionEntryChanged(): void {
    if (!solutionIsRemoteSolution(this.activeSolutionEntry.uri)) {
      return;
    }

    const processEngineVersion = this.activeSolutionEntry.processEngineVersion;
    const activeSolutionHasVersion: boolean = processEngineVersion !== undefined;

    this.showCronjobList = activeSolutionHasVersion ? processEngineSupportsCronjobs(processEngineVersion) : false;
  }
}
