import {FrameworkConfiguration} from 'aurelia-framework';
import {ElectronOidcAuthenticationService} from './electron.oidc-authentication-service';
import {WebOidcAuthenticationService} from './web.oidc-authentication-service';

export async function configure(config: FrameworkConfiguration): Promise<void> {
  const appIsRunningInElectron: boolean = (window as any).nodeRequire;

  if (appIsRunningInElectron) {
    config.container.registerSingleton('AuthenticationService', ElectronOidcAuthenticationService);
  } else {
    config.container.registerSingleton('AuthenticationService', WebOidcAuthenticationService);
  }
}
