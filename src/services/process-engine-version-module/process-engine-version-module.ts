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
