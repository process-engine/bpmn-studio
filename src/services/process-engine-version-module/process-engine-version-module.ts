import {SemVer} from 'semver';

export function processEngineSupportsPagination(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    return undefined;
  }

  const solutionEntryPEVersion = new SemVer(processEngineVersion);

  const alphaVersionWithPagination = new SemVer('8.6.0-alpha.24');
  const betaVersionWithPagination = new SemVer('9.0.0-beta.1');
  const stableVersionWithPagination = new SemVer('8.6.0');

  const solutionEntryIsAlpha: boolean = solutionEntryPEVersion.prerelease[0] === 'alpha';
  const solutionEntryIsBeta: boolean = solutionEntryPEVersion.prerelease[0] === 'beta';

  if (solutionEntryIsAlpha) {
    return solutionEntryPEVersion.compare(alphaVersionWithPagination) >= 0;
  }
  if (solutionEntryIsBeta) {
    return solutionEntryPEVersion.compare(betaVersionWithPagination) >= 0;
  }

  return solutionEntryPEVersion.compare(stableVersionWithPagination) >= 0;
}

export function processEngineSupportsGettingProcessInstances(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    return undefined;
  }

  const solutionEntryPEVersion = new SemVer(processEngineVersion);

  const alphaVersionWithProcessInstanceFunctions = new SemVer('9.0.0-alpha.10');
  const betaVersionWithProcessInstanceFunctions = new SemVer('9.0.0-beta.7');
  const stableVersionWithProcessInstanceFunctions = new SemVer('9.0.0');

  const solutionEntryIsAlpha: boolean = solutionEntryPEVersion.prerelease[0] === 'alpha';
  const solutionEntryIsBeta: boolean = solutionEntryPEVersion.prerelease[0] === 'beta';

  if (solutionEntryIsAlpha) {
    return solutionEntryPEVersion.compare(alphaVersionWithProcessInstanceFunctions) >= 0;
  }
  if (solutionEntryIsBeta) {
    return solutionEntryPEVersion.compare(betaVersionWithProcessInstanceFunctions) >= 0;
  }

  return solutionEntryPEVersion.compare(stableVersionWithProcessInstanceFunctions) >= 0;
}
