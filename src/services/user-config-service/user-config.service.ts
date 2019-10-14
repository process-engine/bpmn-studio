const defaultConfig = {
  'design.activate_linter': true,
};

export class UserConfigService {
  public getUserConfig(key: string): any {
    const currentConfig = this.getCurrentConfig();

    return currentConfig[key];
  }

  public setUserConfig(key: string, value: any): void {
    let customConfig = JSON.parse(window.localStorage.getItem('customUserConfig'));

    if (!customConfig) {
      customConfig = {};
    }

    customConfig[key] = value;
    window.localStorage.setItem('customUserConfig', JSON.stringify(customConfig));
  }

  public persistUserConfig(userConfig: object): void {
    window.localStorage.setItem('customUserConfig', JSON.stringify(userConfig));
  }

  public getCurrentConfig(): object {
    const customConfig = JSON.parse(window.localStorage.getItem('customUserConfig'));

    return Object.assign({}, defaultConfig, customConfig);
  }

  public getDefaultConfig(): object {
    return defaultConfig;
  }
}
