import {bindable} from 'aurelia-framework';
import {ISolutionEntry} from '../../../contracts';

const versionRegex: RegExp = /(\d+)\.(\d+).(\d+)/;
export class Dashboard {
  @bindable() public activeSolutionEntry: ISolutionEntry;
  public showCronjobList: boolean = false;

  public attached(): void {
    this.showCronjobList = this.processEngineSupportsCronjob();
  }

  private processEngineSupportsCronjob(): boolean {
    const processEngineVersion: string = this.activeSolutionEntry.processEngineVersion;

    const noProcessEngineVersionSet: boolean = processEngineVersion === undefined;
    if (noProcessEngineVersionSet) {
      return false;
    }

    const regexResult: RegExpExecArray = versionRegex.exec(processEngineVersion);
    const majorVersion: number = parseInt(regexResult[1]);
    const minorVersion: number = parseInt(regexResult[2]);

    // The version must be 8.4.0 or later
    const processEngineSupportsEvents: boolean = majorVersion > 8 || (majorVersion === 8 && minorVersion >= 4);

    return processEngineSupportsEvents;
  }
}
