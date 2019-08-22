const defaultConfig = {
  activateLinter: true,
};

export class UserConfigService {
  private customConfig: object;

  constructor() {
    this.customConfig = JSON.parse(window.localStorage.getItem('customUserConfig'));
  }

  public getUserConfig(key: string): any {
    this.customConfig = JSON.parse(window.localStorage.getItem('customUserConfig'));

    if (this.customConfig) {
      const config: any = this.customConfig[key];

      if (config !== undefined) {
        return this.customConfig[key];
      }
    }

    return defaultConfig[key];
  }

  public setUserConfig(key: string, value: any): void {
    if (!this.customConfig) {
      this.customConfig = {};
    }

    this.customConfig[key] = value;
    window.localStorage.setItem('customUserConfig', JSON.stringify(this.customConfig));
  }
}
