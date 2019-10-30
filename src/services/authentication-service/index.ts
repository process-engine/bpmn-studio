import {FrameworkConfiguration} from 'aurelia-framework';
import {ElectronOidcAuthenticationService} from './electron.oidc-authentication-service';
import {WebOidcAuthenticationService} from './web.oidc-authentication-service';
import {isRunningInElectron} from '../is-running-in-electron-module/is-running-in-electron.module';

export async function configure(config: FrameworkConfiguration): Promise<void> {
  if (isRunningInElectron()) {
    config.container.registerSingleton('AuthenticationService', ElectronOidcAuthenticationService);
  } else {
    config.container.registerSingleton('AuthenticationService', WebOidcAuthenticationService);
  }
}
