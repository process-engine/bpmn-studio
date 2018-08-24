import {Aurelia} from 'aurelia-framework';

import {NotificationType} from './contracts/index';
import environment from './environment';
import {NotificationService} from './modules/notification/notification.service';

import {oidcConfig} from './open-id-connect-configuration';

export function configure(aurelia: Aurelia): void {

  if (navigator.cookieEnabled === false) {
    const url: string = location.href;
    throw new Error(`In order to use the web version of BPMN Studio please enable cookies for this URL: ${url}.`);
  }

  if ((window as any).nodeRequire) {
    const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;
    const newHost: string = ipcRenderer.sendSync('get_host');

    /**
     * Currently the internal PE is always connected via http.
     * This will be subject to change.
     */
    const processEngineBaseRouteWithProtocol: string = `http://${newHost}`;

    localStorage.setItem('InternalProcessEngineRoute', processEngineBaseRouteWithProtocol);

    aurelia.container.registerInstance('InternalProcessEngineBaseRoute', processEngineBaseRouteWithProtocol);
  } else {
    localStorage.setItem('InternalProcessEngineRoute', environment.baseRoute);
    aurelia.container.registerInstance('InternalProcessEngineBaseRoute', null);
  }

  const customProcessEngineRoute: string = window.localStorage.getItem('processEngineRoute');
  const isCustomProcessEngineRouteSet: boolean = customProcessEngineRoute !== ''
                                              && customProcessEngineRoute !== null;

  const processEngineRoute: string = isCustomProcessEngineRouteSet
  ? customProcessEngineRoute
  : window.localStorage.getItem('InternalProcessEngineRoute');

  const processEngineRouteExists: boolean = processEngineRoute !== null && processEngineRoute !== '';
  if (processEngineRouteExists) {
    environment.baseRoute = processEngineRoute;
    environment.processengine.routes.processes = `${processEngineRoute}/datastore/ProcessDef`;
    environment.processengine.routes.iam = `${processEngineRoute}/iam`;
    environment.processengine.routes.startProcess = `${processEngineRoute}/processengine/start`;
    environment.processengine.routes.userTasks =  `${processEngineRoute}/datastore/UserTask`;
    environment.processengine.routes.importBPMN = `${processEngineRoute}/processengine/create_bpmn_from_xml`;
  }

  aurelia.use
    .standardConfiguration()
    .feature('modules/fetch-http-client')
    .feature('modules/dynamic-ui')
    .feature('modules/notification')
    .feature('modules/diagram-validation-service')
    .feature('modules/management-api_client')
    .feature('modules/authentication')
    .feature('modules/inspect-correlation')
    .feature('modules/solution-explorer-services')
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

    // check if the processengine started successfull
    if ((window as any).nodeRequire) {

      const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;
      // subscribe to processengine status
      ipcRenderer.send('add_internal_processengine_status_listener');
      ipcRenderer.send('add_autoupdater_listener');

      // wait for status to be reported

      ipcRenderer.on('internal_processengine_status', (event: any, status: string, error: string) => {
        if (status !== 'error') {
          return;
        }
        /* This is the URL to an issue in GitHub, describing
         * what the user can do about this failure.
         *
         * TODO: Implement a proper FAQ section and link to that.
         */
        // tslint:disable-next-line: max-line-length
        const targetHref: string = `<a href="javascript:nodeRequire('open')('https://github.com/process-engine/bpmn-studio/issues/316')">click here</a>`;

        const errorMessage: string = `Failed to start ProcessEngine. For further information ${targetHref}.`;
        const notificationService: NotificationService = aurelia.container.get('NotificationService');

        notificationService.showNonDisappearingNotification(NotificationType.ERROR, errorMessage);
      });

      ipcRenderer.on('autoupdater_windows_notification', () => {
        // tslint:disable-next-line: max-line-length
        const targetHref: string = `<a href="javascript:nodeRequire('open')('https://github.com/process-engine/bpmn-studio/issues/715')">click here</a>`;

        const infoMessage: string = `The autoupdater is currently unavailable for the Windows platform.
         There is more information about this here: ${targetHref}.`;
        const notificationService: NotificationService = aurelia.container.get('NotificationService');

        notificationService.showNonDisappearingNotification(NotificationType.INFO, infoMessage);
      });
    }
  });
}
