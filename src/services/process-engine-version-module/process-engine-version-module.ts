import {SemVer} from 'semver';

export function processEngineSupportsPagination(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    return undefined;
  }

  const processEngineIsNoStable: boolean = processEngineVersion.indexOf('-') !== -1;

  const processEngineVersionWithoutReleaseChannel: string = processEngineIsNoStable
    ? processEngineVersion.slice(0, processEngineVersion.indexOf('-'))
    : processEngineVersion;

  const processEngineSemverVersion = new SemVer(processEngineVersionWithoutReleaseChannel);

  const firstVersionWithPagination = new SemVer('9.0.0');

  return processEngineSemverVersion.compare(firstVersionWithPagination) >= 0;
}

export function processEngineSupportsCronjobEvents(processEngineVersion): boolean {
  if (!processEngineVersion) {
    return undefined;
  }

  const solutionEntryPEVersion = new SemVer(processEngineVersion);

  const alphaVersionWithEvents = new SemVer('8.6.0-alpha.18');
  const betaVersionWithEvents = new SemVer('8.6.0-beta.2');
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
