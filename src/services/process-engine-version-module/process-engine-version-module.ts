import {SemVer} from 'semver';

export function processEngineSupportsPagination(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    return undefined;
  }

  const solutionEntryPEVersion = new SemVer(processEngineVersion);

  const firstVersionWithPagination = new SemVer('9.0.0');

  return solutionEntryPEVersion.compare(firstVersionWithPagination) >= 0;
}
