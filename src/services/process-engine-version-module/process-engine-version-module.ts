import {SemVer} from 'semver';

export function processEngineSupportsPagination(solutionEntry): boolean {
  const processEngineVersion: string = solutionEntry.processEngineVersion;

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
