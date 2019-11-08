import {SemVer} from 'semver';

export function processEngineSupportsPagination(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    throw Error(`'${processEngineVersion}' is not a valid ProcesEngine version.`);
  }

  const processEngineVersionWithPaginationSupport: string = '9.0.0';

  return compareVersions(processEngineVersion, processEngineVersionWithPaginationSupport);
}

function compareVersions(processEngineVersion: string, allowedVersion: string): boolean {
  const indexOfReleaseChannel = processEngineVersion.indexOf('-');
  const processEngineIsStable: boolean = indexOfReleaseChannel === -1;

  const versionWithoutReleaseChannel: string = processEngineIsStable
    ? processEngineVersion
    : processEngineVersion.slice(0, indexOfReleaseChannel);

  const solutionEntryPEVersion = new SemVer(versionWithoutReleaseChannel);
  const allowedProcessEngineVersion = new SemVer(allowedVersion);

  return solutionEntryPEVersion.compare(allowedProcessEngineVersion) >= 0;
}

export function processEngineSupportsCronjobEvents(processEngineVersion): boolean {
  if (!processEngineVersion) {
    throw Error(`'${processEngineVersion}' is not a valid ProcesEngine version.`);
  }

  const processEngineIsNoStable: boolean = processEngineVersion.indexOf('-') !== -1;

  const processEngineVersionWithoutReleaseChannel: string = processEngineIsNoStable
    ? processEngineVersion.slice(0, processEngineVersion.indexOf('-'))
    : processEngineVersion;

  const processEngineSemverVersion = new SemVer(processEngineVersionWithoutReleaseChannel);

  const stableVersionWithEvents = new SemVer('9.0.0');

  return processEngineSemverVersion.compare(stableVersionWithEvents) >= 0;
}
