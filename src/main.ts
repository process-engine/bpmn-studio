import {Aurelia} from 'aurelia-framework';

import process from 'process';
import environment from './environment';

import {oidcConfig} from './open-id-connect-configuration';
import {isRunningInElectron} from './services/is-running-in-electron-module/is-running-in-electron.module';

export function configure(aurelia: Aurelia): void {
  if (navigator.cookieEnabled === false) {
    // eslint-disable-next-line no-restricted-globals
    const url: string = location.href;
    throw new Error(`In order to use the web version of BPMN Studio please enable cookies for this URL: ${url}.`);
  }

  if (isRunningInElectron()) {
    const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;
    const newHost: string = ipcRenderer.sendSync('get_host');
    const processEngineVersion: string = ipcRenderer.sendSync('get_version');
    /**
     * Currently the internal PE is always connected via http.
     * This will be subject to change.
     */
    const processEngineBaseRouteWithProtocol: string = `http://${newHost}`;

    localStorage.setItem('InternalProcessEngineRoute', processEngineBaseRouteWithProtocol);
    localStorage.setItem('InternalProcessEngineVersion', processEngineVersion);

    aurelia.container.registerInstance('InternalProcessEngineBaseRoute', processEngineBaseRouteWithProtocol);
  } else {
    (window as any).process = process;
    localStorage.setItem('InternalProcessEngineRoute', environment.baseRoute);
    localStorage.setItem('InternalProcessEngineVersion', null);
    aurelia.container.registerInstance('InternalProcessEngineBaseRoute', null);
  }

  aurelia.use
    .standardConfiguration()
    .globalResources('modules/custom_elements/modal/modal.html')
    .feature('modules/fetch-http-client')
    .feature('services/dynamic-ui-service')
    .feature('services/notification-service')
    .feature('services/user-config-service')
    .feature('services/diagram-validation-service')
    .feature('modules/management-api_client')
    .feature('services/authentication-service')
    /*
     * The services/solution-explorer-services has a hard dependency on
     * EventAggregator and AuthenticationService.
     */
    .feature('services/solution-explorer-services')
    .feature('modules/inspect/token-viewer')
    .feature('modules/inspect/inspect-process-instance')
    .feature('modules/inspect/dashboard')
    .feature('modules/design/diagram-detail')
    .feature('services/diagram-creation-service')
    .feature('services/solution-service')
    .feature('modules/inspect/heatmap')
    .feature('modules/live-execution-tracker')
    .plugin('aurelia-bootstrap')
    .plugin('aurelia-validation')
    .plugin('aurelia-open-id-connect', () => oidcConfig);

  if (environment.debug) {
    aurelia.use.developmentLogging();
  }

  if (environment.testing) {
    aurelia.use.plugin('aurelia-testing');
  }

  aurelia.start().then(() => {
    aurelia.setRoot();

    if (isRunningInElectron()) {
      const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;
      ipcRenderer.send('app_ready');
    }
  });
}
