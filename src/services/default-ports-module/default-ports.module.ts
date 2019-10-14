import {StudioVersion} from '../../contracts/index';

export function getPortListByVersion(studioVersion: StudioVersion): Array<number> {
  const portList = [];

  const firstPort: number = getFirstPortByVersion(studioVersion);

  for (let index = 0; index < 10; index++) {
    portList.push(firstPort + index * 10);
  }

  return portList;
}

function getFirstPortByVersion(studioVersion: StudioVersion): number {
  switch (studioVersion) {
    case StudioVersion.Dev:
      return 56300;
    case StudioVersion.Alpha:
      return 56200;
    case StudioVersion.Beta:
      return 56100;
    case StudioVersion.Stable:
      return 56000;
    default:
      throw new Error('Could not get default port for internal process engine');
  }
}
