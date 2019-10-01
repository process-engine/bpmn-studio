import {SemVer} from 'semver';

export function processEngineSupportsPagination(processEngineVersion: string): boolean {
  if (!processEngineVersion) {
    return undefined;
  }

  const processEngineVersionWithoutReleaseChannel: string = processEngineVersion.slice(
    0,
    processEngineVersion.indexOf('-'),
  );

  const processEngineSemverVersion = new SemVer(processEngineVersionWithoutReleaseChannel);

  const firstVersionWithPagination = new SemVer('9.0.0');

  return processEngineSemverVersion.compare(firstVersionWithPagination) >= 0;
}
