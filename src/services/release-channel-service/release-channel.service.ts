import isDev from 'electron-is-dev';
import {StudioVersion} from '../../contracts/index';

export default class ReleaseChannel {
  private version: string;

  constructor(version: string) {
    this.version = version;
  }

  public isDev(): boolean {
    return isDev;
  }

  public isAlpha(): boolean {
    return this.version.includes('alpha');
  }

  public isBeta(): boolean {
    return this.version.includes('beta');
  }

  public isStable(): boolean {
    return !this.isDev() && !this.isAlpha() && !this.isBeta();
  }

  public isFeature(): boolean {
    return this.version.includes('feature');
  }

  public getName(): string {
    if (this.isDev()) {
      return 'dev';
    }
    if (this.isAlpha()) {
      return 'alpha';
    }
    if (this.isBeta()) {
      return 'beta';
    }
    if (this.isFeature()) {
      return 'feature';
    }

    return 'stable';
  }

  public getVersion(): StudioVersion {
    if (this.isDev()) {
      return StudioVersion.Dev;
    }
    if (this.isAlpha()) {
      return StudioVersion.Alpha;
    }
    if (this.isBeta()) {
      return StudioVersion.Beta;
    }

    return StudioVersion.Stable;
  }
}
