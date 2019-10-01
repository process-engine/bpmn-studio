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

  const stableVersionWithEvents = new SemVer('9.0.0');

  return solutionEntryPEVersion.compare(stableVersionWithEvents) >= 0;
}
