import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {SemVer} from 'semver';

import {ISolutionEntry} from '../../contracts';
import environment from '../../environment';

@inject(EventAggregator)
export class ProcessEngineVersionService {
  private eventAggregator: EventAggregator;
  private solutionEntry: ISolutionEntry;

  constructor(eventAggregator: EventAggregator) {
    this.eventAggregator = eventAggregator;

    this.eventAggregator.subscribe(
      environment.events.configPanel.solutionEntryChanged,
      (solutionEntry: ISolutionEntry) => {
        this.solutionEntry = solutionEntry;
      },
    );
  }

  public supportsPaginationAndNewDataModels(): boolean {
    const processEngineVersion: string = this.solutionEntry.processEngineVersion;

    const solutionEntryPEVersion = new SemVer(processEngineVersion);

    const alphaVersionWithEvents = new SemVer('8.6.0-alpha.24');
    const betaVersionWithEvents = new SemVer('9.0.0-beta.1');
    const stableVersionWithEvents = new SemVer('8.6.0');

    const solutionEntryIsAlpha: boolean = solutionEntryPEVersion.prerelease[0] === 'alpha';
    const solutionEntryIsBeta: boolean = solutionEntryPEVersion.prerelease[0] === 'beta';

    if (solutionEntryIsAlpha) {
      return solutionEntryPEVersion.compare(alphaVersionWithEvents) >= 0;
    }
    if (solutionEntryIsBeta) {
      return solutionEntryPEVersion.compare(betaVersionWithEvents) >= 0;
    }

    return solutionEntryPEVersion.compare(stableVersionWithEvents) >= 0;
  }
}
