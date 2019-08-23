const defaultConfig = {
  'design.activate_linter': true,
};

export class UserConfigService {
  private customConfig: object;

  constructor() {
    this.customConfig = JSON.parse(window.localStorage.getItem('customUserConfig'));
  }

  public getUserConfig(key: string): any {
    const currentConfig = this.getCurrentConfig();

    return currentConfig[key];
  }

  public setUserConfig(key: string, value: any): void {
    this.customConfig = JSON.parse(window.localStorage.getItem('customUserConfig'));

    if (!this.customConfig) {
      this.customConfig = {};
    }

    this.customConfig[key] = value;
    window.localStorage.setItem('customUserConfig', JSON.stringify(this.customConfig));
  }

  public getCurrentConfig(): object {
    this.customConfig = JSON.parse(window.localStorage.getItem('customUserConfig'));

    return Object.assign({}, defaultConfig, this.customConfig);
  }

  public getDefaultConfig(): object {
    return defaultConfig;
  }
}
