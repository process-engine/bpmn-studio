import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {Router, RouterConfiguration} from 'aurelia-router';
import {OpenIdConnect} from 'aurelia-open-id-connect';

/**
 * This import statement loads bootstrap. Its required because otherwise
 * its not executed.
 */
import 'bootstrap';
import * as Bluebird from 'bluebird';

import {NotificationType} from './contracts/index';
import environment from './environment';
import {NotificationService} from './services/notification-service/notification.service';

import {oidcConfig} from './open-id-connect-configuration';
import {isRunningInElectron} from './services/is-running-in-electron-module/is-running-in-electron.module';

Bluebird.Promise.config({cancellation: true});

@inject(OpenIdConnect, 'NotificationService', EventAggregator)
export class App {
  public showSolutionExplorer: boolean = false;

  private openIdConnect: OpenIdConnect | any;
  private notificationService: NotificationService;
  private eventAggregator: EventAggregator;
  private subscriptions: Array<Subscription>;

  private preventDefaultBehaviour: EventListener;
  private ipcRenderer: any | null = null;
  private router: Router;

  constructor(
    openIdConnect: OpenIdConnect,
    notificationService: NotificationService,
    eventAggregator: EventAggregator,
  ) {
    this.openIdConnect = openIdConnect;
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;

    if (isRunningInElectron()) {
      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;

      this.ipcRenderer.on('database-export-error', (event: Event, errorMessage: string) => {
        this.notificationService.showNotification(NotificationType.ERROR, errorMessage);
      });
    }
  }

  public activate(): void {
    this.migrateOpenDiagramStatesInLocalStorage();

    this.preventDefaultBehaviour = (event: Event): boolean => {
      event.preventDefault();

      if (!isRunningInElectron()) {
        this.notificationService.showNotification(
          NotificationType.INFO,
          'Drag-and-Drop is currently only available for the Electron application.',
        );
      }

      return false;
    };

    this.showSolutionExplorer =
      window.localStorage.getItem('SolutionExplorerVisibility') === 'true' ||
      window.localStorage.getItem('SolutionExplorerVisibility') === null;

    const showSolutionExplorer: string = this.showSolutionExplorer ? 'true' : 'false';
    window.localStorage.setItem('SolutionExplorerVisibility', showSolutionExplorer);

    this.subscriptions = [
      this.eventAggregator.subscribe(
        environment.events.solutionExplorerPanel.toggleSolutionExplorer,
        (show: boolean) => {
          this.showSolutionExplorer = show;

          if (this.showSolutionExplorer) {
            window.localStorage.setItem('SolutionExplorerVisibility', 'true');
          } else {
            window.localStorage.setItem('SolutionExplorerVisibility', 'false');
          }
        },
      ),
    ];

    /*
     * These EventListeners are used to prevent the BPMN Studio from redirecting after
     * trying to drop a file to the BPMN Studio.
     */
    document.addEventListener('dragover', this.preventDefaultBehaviour);
    document.addEventListener('drop', this.preventDefaultBehaviour);

    const openIdConnectRoute: string = window.localStorage.getItem('openIdRoute');

    const openIdConnectRouteIsCustom: boolean =
      openIdConnectRoute !== null && openIdConnectRoute !== undefined && openIdConnectRoute !== '';

    if (openIdConnectRouteIsCustom) {
      /*
       * TODO: The environment variables should not carry state. This should be done via a configurationService.
       * https://github.com/process-engine/bpmn-studio/issues/673
       */
      environment.openIdConnect.authority = openIdConnectRoute;

      this.openIdConnect.configuration.userManagerSettings.authority = openIdConnectRoute;
      // eslint-disable-next-line no-underscore-dangle
      this.openIdConnect.userManager._settings._authority = openIdConnectRoute;

      oidcConfig.userManagerSettings.authority = openIdConnectRoute;
    }

    if (isRunningInElectron()) {
      this.ipcRenderer.on('menubar__open_preferences', this.openPreferences);
    }
  }

  public deactivate(): void {
    document.removeEventListener('dragover', this.preventDefaultBehaviour);
    document.removeEventListener('drop', this.preventDefaultBehaviour);

    this.disposeAllSubscriptions();
  }

  private openPreferences = async (_: Event): Promise<void> => {
    this.router.navigateToRoute('preferences');
  };

  private disposeAllSubscriptions(): void {
    this.subscriptions.forEach((subscription: Subscription) => {
      subscription.dispose();
    });
  }

  public configureRouter(config: RouterConfiguration, router: Router): void {
    if (!isRunningInElectron()) {
      config.options.pushState = true;
      config.options.baseRoute = '/';
    }

    config.title = 'BPMN Studio';

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
        route: ['think/:view?/diagram/:diagramName?'],
        title: 'Think',
        name: 'think',
        moduleId: 'modules/think/think',
        nav: 0,
        href: '',
      },
      {
        route: ['design/:view?/diagram/:diagramName?'],
        title: 'Design',
        name: 'design',
        moduleId: 'modules/design/design',
        nav: 1,
        href: '',
      },
      {
        route: ['inspect/:view?/diagram/:diagramName?'],
        title: 'Inspect',
        name: 'inspect',
        moduleId: 'modules/inspect/inspect',
        nav: 2,
        href: '',
      },
      {
        route: 'preferences',
        title: 'Preferences',
        name: 'preferences',
        moduleId: 'modules/user-preferences/user-preferences',
      },
    ]);

    this.openIdConnect.configure(config);
    this.router = router;
  }

  private migrateOpenDiagramStatesInLocalStorage(): void {
    Object.keys(localStorage)
      .filter((localStorageKey: string) => {
        return localStorageKey.startsWith('Open Diagram:');
      })
      .forEach((localStorageKey) => {
        const diagramState = JSON.parse(localStorage.getItem(localStorageKey));

        const diagramStateHasOldMetadata: boolean = diagramState.metaData !== undefined;
        if (diagramStateHasOldMetadata) {
          diagramState.metadata = diagramState.metaData;
          delete diagramState.metaData;
        }

        localStorage.setItem(localStorageKey, JSON.stringify(diagramState));
      });
  }
}
