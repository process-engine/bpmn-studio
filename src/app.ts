import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {computedFrom, inject} from 'aurelia-framework';
import {Router, RouterConfiguration} from 'aurelia-router';
/**
 * This import statement loads bootstrap. Its required because otherwise
 * its not executed.
 */
import 'bootstrap';

import {OpenIdConnect} from 'aurelia-open-id-connect';

import {IConfigService, NotificationType} from './contracts/index';
import environment from './environment';
import {AuthenticationService} from './modules/authentication/authentication.service';
import {NotificationService} from './modules/notification/notification.service';

import {oidcConfig} from './open-id-connect-configuration';
@inject(OpenIdConnect, 'AuthenticationService', 'NotificationService', EventAggregator, 'ConfigService')
export class App {

  private _openIdConnect: OpenIdConnect | any;
  private _authenticationService: AuthenticationService;
  private _router: Router;
  private _notificationService: NotificationService;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;
  private _configService: IConfigService;

  private _preventDefaultBehaviour: EventListener;

  constructor(openIdConnect: OpenIdConnect,
              authenticationService: AuthenticationService,
              notificationService: NotificationService,
              eventAggregator: EventAggregator,
              configService: IConfigService) {
    this._openIdConnect = openIdConnect;
    this._authenticationService = authenticationService;
    this._notificationService = notificationService;
    this._eventAggregator = eventAggregator;
    this._configService = configService;
  }

  @computedFrom('_configService.solutionExplorerIsVisible')
  public get showSolutionExplorer(): boolean {
    return this._configService.solutionExplorerIsVisible;
  }

  public activate(): void {
    this._preventDefaultBehaviour = (event: Event): boolean => {
      event.preventDefault();

      const isRunningInBrowser: boolean = Boolean(!(window as any).nodeRequire);

      if (isRunningInBrowser) {
        this._notificationService.showNotification(NotificationType.INFO, 'Drag-and-Drop is currently only available for the Electron application.');
      }

      return false;
    };

    /*
    * These EventListeners are used to prevent the BPMN-Studio from redirecting after
    * trying to drop a file to the BPMN-Studio.
    */
    document.addEventListener('dragover', this._preventDefaultBehaviour);
    document.addEventListener('drop', this._preventDefaultBehaviour);

    const openIdConnectRoute: string = window.localStorage.getItem('openIdRoute');

    const openIdConnectRouteIsCustom: boolean = openIdConnectRoute !== null
                                             && openIdConnectRoute !== undefined
                                             && openIdConnectRoute !== '';

    if (openIdConnectRouteIsCustom) {
      /*
      * TODO: The environment variables should not carry state. This should be done via a configurationService.
      * https://github.com/process-engine/bpmn-studio/issues/673
      */
      environment.openIdConnect.authority = openIdConnectRoute;

      this._openIdConnect.configuration.userManagerSettings.authority = openIdConnectRoute;
      this._openIdConnect.userManager._settings._authority = openIdConnectRoute;

      oidcConfig.userManagerSettings.authority = openIdConnectRoute;
    }
  }

  public deactivate(): void {
    document.removeEventListener('dragover', this._preventDefaultBehaviour);
    document.removeEventListener('drop', this._preventDefaultBehaviour);

    this._disposeAllSubscriptions();
  }

  private _disposeAllSubscriptions(): void {
    this._subscriptions.forEach((subscription: Subscription) => {
      subscription.dispose();
    });
  }

  private _parseDeepLinkingUrl(url: string): string {
    const customProtocolPrefix: string = 'bpmn-studio://';
    const urlFragment: string = url.substring(customProtocolPrefix.length);
    return urlFragment;
  }

  public configureRouter(config: RouterConfiguration, router: Router): void {
    this._router = router;

    const isRunningInElectron: boolean = Boolean((window as any).nodeRequire);

    if (isRunningInElectron) {
      const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;
      ipcRenderer.on('deep-linking-request', async(event: any, url: string) => {

        const urlFragment: string = this._parseDeepLinkingUrl(url);

        if (urlFragment === 'signout-oidc') {
          this._authenticationService.finishLogout();
        } else if (urlFragment.startsWith('signin-oidc')) {
          this._authenticationService.loginViaDeepLink(urlFragment);
        }
      });

      ipcRenderer.send('deep-linking-ready');
    }

    if (!isRunningInElectron) {
      config.options.pushState = true;
      config.options.baseRoute = '/';
    }

    config.title = 'BPMN-Studio';

    config.map([
      {
        route: [''],
        title: 'Start Page',
        name: 'start-page',
        moduleId: 'modules/start-page/start-page',
      },
      {
        route: ['processdef', 'processdef/:diagramName?'],
        title: 'Process Definition List',
        name: 'processdef-list',
        moduleId: 'modules/think/processdef-list/processdef-list',
        nav: true,
      },
      {
        route: ['dashboard'],
        title: 'Dashboard',
        name: 'dashboard',
        moduleId: 'modules/inspect/dashboard/dashboard',
        nav: true,
      },
      {
        route: ['task', 'processdef/:diagramName/task'],
        title: 'Task List',
        name: 'task-list-processmodel',
        moduleId: 'modules/task-list-container/task-list-container',
        nav: false,
      },
      {
        route: ['correlation/:correlationId/task'],
        title: 'Task List',
        name: 'task-list-correlation',
        moduleId: 'modules/task-list-container/task-list-container',
        nav: false,
      },
      {
        route: ['process'],
        title: 'Process Instance List',
        name: 'process-list',
        moduleId: 'modules/inspect/process-list/process-list',
        nav: true,
      },
      {
        route: ['correlation/:correlationId/diagram/:diagramName/task/:taskId/dynamic-ui'],
        title: 'Task Dynamic UI',
        name: 'task-dynamic-ui',
        moduleId: 'modules/task-dynamic-ui/task-dynamic-ui',
      },
      {
        route: ['diagram/detail/:diagramName?'],
        title: 'Diagram Detail',
        name: 'diagram-detail',
        moduleId: 'modules/design/diagram-detail/diagram-detail',
      },
      {
        route: 'configuration',
        title: 'Configuration',
        name: 'configuration',
        moduleId: 'modules/config-panel/config-panel',
      },
      {
        route: ['/correlation/:correlationId/diagram/:diagramName/live-execution-tracker'],
        title: 'Live Execution Tracker',
        name: 'live-execution-tracker',
        moduleId: 'modules/live-execution-tracker/live-execution-tracker',
      },
      {
        route: ['inspect', 'inspect/:view?/:diagramName?'],
        title: 'Inspect',
        name: 'inspect',
        moduleId: 'modules/inspect/inspect',
      },
    ]);

    this._openIdConnect.configure(config);
  }
}
