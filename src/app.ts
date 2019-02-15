import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {Router, RouterConfiguration} from 'aurelia-router';
/**
 * This import statement loads bootstrap. Its required because otherwise
 * its not executed.
 */
import 'bootstrap';

import {OpenIdConnect} from 'aurelia-open-id-connect';

import {IAuthenticationService, NotificationType} from './contracts/index';
import environment from './environment';
import {NotificationService} from './modules/notification/notification.service';

import {oidcConfig} from './open-id-connect-configuration';
@inject(OpenIdConnect, 'AuthenticationService', 'NotificationService', EventAggregator)
export class App {
  public showSolutionExplorer: boolean = false;

  private _openIdConnect: OpenIdConnect | any;
  private _authenticationService: IAuthenticationService;
  private _notificationService: NotificationService;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;

  private _preventDefaultBehaviour: EventListener;

  constructor(openIdConnect: OpenIdConnect,
              authenticationService: IAuthenticationService,
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

    this.showSolutionExplorer = window.localStorage.getItem('SolutionExplorerVisibility') === 'true'
      || window.localStorage.getItem('SolutionExplorerVisibility') === null;

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

  public configureRouter(config: RouterConfiguration, router: Router): void {
    const isRunningInElectron: boolean = Boolean((window as any).nodeRequire);

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
        route: ['dashboard'],
        title: 'Dashboard',
        name: 'dashboard',
        moduleId: 'modules/inspect/dashboard/dashboard',
        nav: false,
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
        route: ['instance/:processInstanceId/task'],
        title: 'Task List',
        name: 'task-list-processinstance',
        moduleId: 'modules/task-list-container/task-list-container',
        nav: false,
      },
      {
        route: ['process'],
        title: 'Process Instance List',
        name: 'process-list',
        moduleId: 'modules/inspect/process-list/process-list',
        nav: false,
      },
      {
        route: ['correlation/:correlationId/diagram/:diagramName/instance/:processInstanceId/task/:taskId/dynamic-ui'],
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
        route: ['/correlation/:correlationId/diagram/:diagramName/instance/:processInstanceId/live-execution-tracker'],
        title: 'Live Execution Tracker',
        name: 'live-execution-tracker',
        moduleId: 'modules/live-execution-tracker/live-execution-tracker',
      },
      {
        route: 'settings',
        title: 'Settings',
        name: 'settings',
        moduleId: 'modules/config-panel/config-panel',
      },
      {
        route: ['think', 'think/:view?/diagram/:diagramName?'],
        title: 'Think',
        name: 'think',
        moduleId: 'modules/think/think',
        nav: 0,
      },
      {
        route: ['design', 'design/:view?/diagram/:diagramName?'],
        title: 'Design',
        name: 'design',
        moduleId: 'modules/design/design',
        nav: 1,
      },
      {
        route: ['inspect', 'inspect/:view?/diagram/:diagramName?'],
        title: 'Inspect',
        name: 'inspect',
        moduleId: 'modules/inspect/inspect',
        nav: 2,
      },
    ]);

    this._openIdConnect.configure(config);
  }
}
