import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {Router, RouterConfiguration} from 'aurelia-router';

import {OpenIdConnect} from 'aurelia-open-id-connect';

import {NotificationType} from './contracts/index';
import environment from './environment';
import {AuthenticationService} from './modules/authentication/authentication.service';
import {NotificationService} from './modules/notification/notification.service';

@inject(OpenIdConnect, 'AuthenticationService', 'NotificationService', EventAggregator)
export class App {
  public showSolutionExplorer: boolean = false;

  private _openIdConnect: OpenIdConnect;
  private _authenticationService: AuthenticationService;
  private _router: Router;
  private _notificationService: NotificationService;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;

  private _preventDefaultBehaviour: EventListener;

  constructor(openIdConnect: OpenIdConnect,
              authenticationService: AuthenticationService,
              notificationService: NotificationService,
              eventAggregator: EventAggregator) {
    this._openIdConnect = openIdConnect;
    this._authenticationService = authenticationService;
    this._notificationService = notificationService;
    this._eventAggregator = eventAggregator;
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

    this.showSolutionExplorer = window.localStorage.getItem('SolutionExplorerVisibility') === 'true';

    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.processSolutionPanel.toggleProcessSolutionExplorer, () => {
        this.showSolutionExplorer = !this.showSolutionExplorer;
        if (this.showSolutionExplorer) {
          window.localStorage.setItem('SolutionExplorerVisibility', 'true');
        } else {
          window.localStorage.setItem('SolutionExplorerVisibility', 'false');
        }
      }),
    ];

    /*
    * These EventListeners are used to prevent the BPMN-Studio from redirecting after
    * trying to drop a file to the BPMN-Studio.
    */
    document.addEventListener('dragover', this._preventDefaultBehaviour);
    document.addEventListener('drop', this._preventDefaultBehaviour);
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
        route: ['processdef', 'processdef/:page?'],
        title: 'Process Definition List',
        name: 'processdef-list',
        moduleId: 'modules/processdef-list/processdef-list',
        nav: true,
      },
      {
        route: ['dashboard'],
        title: 'Dashboard',
        name: 'dashboard',
        moduleId: 'modules/dashboard/dashboard',
        nav: true,
      },
      {
        route: ['task', 'processdef/:processModelId/task'],
        title: 'Task List',
        name: 'task-list-processmodel',
        moduleId: 'modules/task-list/task-list',
        nav: false,
      },
      {
        route: ['correlation/:correlationId/task'],
        title: 'Task List',
        name: 'task-list-correlation',
        moduleId: 'modules/task-list/task-list',
        nav: false,
      },
      {
        route: ['process', 'processdef/:processModelId/process'],
        title: 'Process Instance List',
        name: 'process-list',
        moduleId: 'modules/process-list/process-list',
        nav: true,
      },
      {
        route: ['processdef/:processModelId/task/:userTaskId/dynamic-ui'],
        title: 'Task Dynamic UI',
        name: 'task-dynamic-ui',
        moduleId: 'modules/task-dynamic-ui/task-dynamic-ui',
      },
      {
        route: ['processdef/:processModelId/detail'],
        title: 'ProcessDef Detail',
        name: 'processdef-detail',
        moduleId: 'modules/processdef-detail/processdef-detail',
      },
      {
        route: ['diagram/detail'],
        title: 'Diagram Detail',
        name: 'diagram-detail',
        moduleId: 'modules/diagram-detail/diagram-detail',
      },
      {
        route: 'configuration',
        title: 'Configuration',
        name: 'configuration',
        moduleId: 'modules/config-panel/config-panel',
      },
      {
        route: 'waitingroom/:correlationId/:processModelId',
        title: 'Waiting Room',
        name: 'waiting-room',
        moduleId: 'modules/waiting-room/waiting-room',
      },
      {
        route: 'process/:processModelId/inspect',
        title: 'Inspect',
        name: 'inspect',
        moduleId: 'modules/inspect-correlation/inspect-correlation',
      },
    ]);

    this._openIdConnect.configure(config);
  }
}
