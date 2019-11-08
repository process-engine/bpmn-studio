import {SemVer} from 'semver';

export function processEngineSupportsPagination(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    throw Error(`'${processEngineVersion}' is not a valid ProcesEngine version.`);
  }

  const processEngineVersionWithPaginationSupport: string = '9.0.0';

  return compareVersions(processEngineVersion, processEngineVersionWithPaginationSupport);
}

export function processEngineSupportsCronjobEvents(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    throw Error(`'${processEngineVersion}' is not a valid ProcesEngine version.`);
  }

  const processEngineVersionWithCronjobEventSupport: string = '9.0.0';

  return compareVersions(processEngineVersion, processEngineVersionWithCronjobEventSupport);
}

export function processEngineSupportsCronjobs(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    throw Error(`'${processEngineVersion}' is not a valid ProcesEngine version.`);
  }

  const processEngineVersionWithCronjobSupport: string = '8.4.0';

  return compareVersions(processEngineVersion, processEngineVersionWithCronjobSupport);
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
