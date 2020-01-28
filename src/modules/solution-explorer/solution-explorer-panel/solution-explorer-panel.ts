import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, computedFrom, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IResponse} from '@essential-projects/http_contracts';
import {
  AuthenticationStateEvent,
  IFile,
  IInputEvent,
  ISolutionEntry,
  ISolutionService,
  NotificationType,
  StudioVersion,
} from '../../../contracts/index';

import environment from '../../../environment';
import {NotificationService} from '../../../services/notification-service/notification.service';
import {SolutionExplorerList} from '../solution-explorer-list/solution-explorer-list';

import {getPortListByVersion} from '../../../services/default-ports-module/default-ports.module';
import {HttpFetchClient} from '../../fetch-http-client/http-fetch-client';
import {solutionIsRemoteSolution} from '../../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';
import {isRunningInElectron} from '../../../services/is-running-in-electron-module/is-running-in-electron.module';
import {OpenDiagramStateService} from '../../../services/solution-explorer-services/open-diagram-state.service';

type RemoteSolutionListEntry = {
  uri: string;
  status: boolean;
  version?: StudioVersion;
};

enum SupportedProtocols {
  HTTPS = 'https://',
  HTTP = 'http://',
}

/**
 * This component handels:
 *  - Opening files via drag and drop
 *  - Opening files via double click
 *  - Opening solution/diagrams via input field
 *  - Refreshing all opened solutions via button
 *  - Refreshing on login/logout
 *  - Updating the remote processengine uri if needed
 */
@inject(EventAggregator, 'NotificationService', Router, 'SolutionService', 'HttpFetchClient', 'OpenDiagramStateService')
export class SolutionExplorerPanel {
  @observable public selectedProtocol: string = 'http://';

  // Fields below are bound from the html view.
  public solutionExplorerList: SolutionExplorerList;
  public solutionInput: HTMLInputElement;
  public openDiagramInput: HTMLInputElement;
  public showOpenRemoteSolutionModal: boolean = false;
  @bindable public uriOfRemoteSolutionWithoutProtocol: string;
  public solutionExplorerPanel: SolutionExplorerPanel = this;
  public remoteSolutionHistoryStatus: Map<string, boolean> = new Map<string, boolean>();
  public availableDefaultRemoteSolutions: Array<RemoteSolutionListEntry> = [];
  public isConnecting: boolean = false;
  public connectionError: string;

  public supportedProtocols: typeof SupportedProtocols = SupportedProtocols;

  private eventAggregator: EventAggregator;
  private notificationService: NotificationService;
  private router: Router;
  // TODO: Add typings
  private ipcRenderer: any | null = null;
  private subscriptions: Array<Subscription> = [];
  private solutionService: ISolutionService;
  private openDiagramStateService: OpenDiagramStateService;
  private remoteSolutionHistoryStatusPollingTimer: NodeJS.Timer;
  private remoteSolutionHistoryStatusIsPolling: boolean;

  private httpFetchClient: HttpFetchClient;

  constructor(
    eventAggregator: EventAggregator,
    notificationService: NotificationService,
    router: Router,
    solutionService: ISolutionService,
    httpFetchClient: HttpFetchClient,
    openDiagramStateService: OpenDiagramStateService,
  ) {
    this.eventAggregator = eventAggregator;
    this.notificationService = notificationService;
    this.router = router;
    this.solutionService = solutionService;
    this.httpFetchClient = httpFetchClient;
    this.openDiagramStateService = openDiagramStateService;

    if (isRunningInElectron()) {
      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
    }
  }

  public get canReadFromFileSystem(): boolean {
    return isRunningInElectron();
  }

  public get connectionErrorExists(): boolean {
    return this.connectionError !== undefined;
  }

  public get remoteSolutionHistoryWithStatus(): Array<RemoteSolutionListEntry> {
    return this.loadRemoteSolutionHistory()
      .reverse()
      .map((solutionUri: string) => {
        return {
          uri: solutionUri,
          status: this.remoteSolutionHistoryStatus.get(solutionUri),
        };
      });
  }

  @computedFrom('availableDefaultRemoteSolutions.length', 'remoteSolutionHistoryWithStatus.length')
  public get suggestedRemoteSolutions(): Array<RemoteSolutionListEntry> {
    const filteredRemoteSolutionHistory: Array<RemoteSolutionListEntry> = this.remoteSolutionHistoryWithStatus.filter(
      (remoteSolution: RemoteSolutionListEntry) => {
        const remoteSolutionIsDefaultRemoteSolution: boolean = this.availableDefaultRemoteSolutions.some(
          (defaultRemoteSolution: RemoteSolutionListEntry) => {
            return defaultRemoteSolution.uri === remoteSolution.uri;
          },
        );

        return !remoteSolutionIsDefaultRemoteSolution;
      },
    );

    const suggestedRemoteSolutions: Array<RemoteSolutionListEntry> = [
      ...this.availableDefaultRemoteSolutions,
      ...filteredRemoteSolutionHistory,
    ];

    return suggestedRemoteSolutions;
  }

  @computedFrom('suggestedRemoteSolutions.length')
  public get unconnectedSuggestedRemoteSolutions(): Array<RemoteSolutionListEntry> {
    const connectedSolutions: Array<ISolutionEntry> = this.solutionService.getAllSolutionEntries();

    const unconnectedSuggestedRemoteSolutions: Array<RemoteSolutionListEntry> = this.suggestedRemoteSolutions.filter(
      (remoteSolution) => {
        return !connectedSolutions.some((connectedSolution: ISolutionEntry) => {
          return connectedSolution.uri === remoteSolution.uri;
        });
      },
    );

    return unconnectedSuggestedRemoteSolutions;
  }

  @computedFrom('unconnectedSuggestedRemoteSolutions.length')
  public get unconnectedSuggestedRemoteSolutionsExist(): boolean {
    return this.unconnectedSuggestedRemoteSolutions.length > 0;
  }

  public get uriOfRemoteSolution(): string {
    return `${this.selectedProtocol}${this.uriOfRemoteSolutionWithoutProtocol}`;
  }

  public get uriIsEmpty(): boolean {
    const uriIsEmtpy: boolean =
      this.uriOfRemoteSolutionWithoutProtocol === undefined || this.uriOfRemoteSolutionWithoutProtocol.length === 0;

    return uriIsEmtpy;
  }

  public get uriIsValid(): boolean {
    /**
     * This RegEx checks if the entered URI is valid or not.
     */
    // TODO Check if this still works
    const urlRegEx: RegExp = /^(?:http(s)?:\/\/)+[\w.-]?[\w\-._~:/?#[\]@!$&'()*+,;=.]+$/g;
    const uriIsValid: boolean = urlRegEx.test(this.uriOfRemoteSolution);

    return uriIsValid;
  }

  public async bind(): Promise<void> {
    // Open the solution of the currently configured processengine instance on startup.
    const uriOfProcessEngine: string = window.localStorage.getItem('InternalProcessEngineRoute');

    const persistedInternalSolution: ISolutionEntry = this.solutionService.getSolutionEntryForUri(uriOfProcessEngine);
    const internalSolutionWasPersisted: boolean = persistedInternalSolution !== undefined;

    if ((window as any).nodeRequire) {
      try {
        if (internalSolutionWasPersisted) {
          this.solutionExplorerList.openSolution(uriOfProcessEngine, false, persistedInternalSolution.identity);
        } else {
          this.solutionExplorerList.openSolution(uriOfProcessEngine);
        }
      } catch {
        return;
      }
    }

    // Open the previously opened solutions.
    const previouslyOpenedSolutions: Array<ISolutionEntry> = this.solutionService.getPersistedEntries();
    previouslyOpenedSolutions.forEach((entry: ISolutionEntry) => {
      // We are not adding the solution of the connect PE here again since that happened above.
      const entryIsNotConnectedProcessEngine: boolean = entry.uri !== uriOfProcessEngine;
      if (entryIsNotConnectedProcessEngine) {
        /**
         * Since we can't distinguish if the persisted ProcessEngine was an
         * internal or external one yet, we consume any connection error
         * produced by the openSolution method.
         */
        try {
          this.solutionExplorerList.openSolution(entry.uri, false, entry.identity);
        } catch (error) {
          // Do nothing
        }
      }
    });

    const persistedOpenDiagrams: Array<IDiagram> = this.solutionService.getOpenDiagrams();
    for (const persistedOpenDiagram of persistedOpenDiagrams) {
      try {
        await this.solutionExplorerList.openDiagram(persistedOpenDiagram.uri);
      } catch {
        // Do nothing
      }
    }

    if (isRunningInElectron()) {
      this.registerElectronHooks();
    }
  }

  public async attached(): Promise<void> {
    if (isRunningInElectron()) {
      document.addEventListener('drop', this.openDiagramOnDropBehaviour);
    }

    this.subscriptions = [
      this.eventAggregator.subscribe(environment.events.diagramDetail.onDiagramDeployed, () => {
        this.refreshSolutions();
      }),
      this.eventAggregator.subscribe(environment.events.startPage.openLocalSolution, () => {
        this.openSolution();
      }),
      this.eventAggregator.subscribe(environment.events.startPage.openDiagram, () => {
        this.openDiagram();
      }),
      this.eventAggregator.subscribe(environment.events.startPage.createDiagram, () => {
        this.createNewDiagram();
      }),
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, () => {
        this.solutionExplorerList.refreshSolutions();
      }),
    ];
  }

  public detached(): void {
    if (isRunningInElectron()) {
      this.removeElectronFileOpeningHooks();
      document.removeEventListener('drop', this.openDiagramOnDropBehaviour);
    }

    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public async openRemoteSolutionModal(): Promise<void> {
    this.showOpenRemoteSolutionModal = true;

    await this.updateRemoteSolutionHistoryStatus();
    this.startPollingOfRemoteSolutionHistoryStatus();
    this.updateDefaultRemoteSolutions();
  }

  public removeSolutionFromHistory(solutionUri: string): void {
    this.removeSolutionFromSolutionHistroy(solutionUri);
  }

  public selectProtocol(protocol: SupportedProtocols): void {
    this.selectedProtocol = protocol;
  }

  public closeRemoteSolutionModal(): void {
    this.stopPollingOfRemoteSolutionHistoryStatus();
    this.solutionExplorerList.cancelOpeningSolution(this.uriOfRemoteSolution);
    this.isConnecting = false;
    this.showOpenRemoteSolutionModal = false;
    this.uriOfRemoteSolutionWithoutProtocol = undefined;
    this.connectionError = undefined;
  }

  public uriOfRemoteSolutionWithoutProtocolChanged(): void {
    if (this.uriOfRemoteSolutionWithoutProtocol === undefined) {
      return;
    }

    for (const protocol of Object.values(SupportedProtocols)) {
      if (this.uriOfRemoteSolutionWithoutProtocol.startsWith(protocol)) {
        this.uriOfRemoteSolutionWithoutProtocol = this.uriOfRemoteSolutionWithoutProtocol.replace(protocol, '');

        this.selectProtocol(protocol);
      }
    }
  }

  public async openRemoteSolution(): Promise<void> {
    if (!this.uriIsValid || this.uriIsEmpty) {
      return;
    }

    this.connectionError = undefined;

    try {
      const lastCharacterIsASlash: boolean = this.uriOfRemoteSolutionWithoutProtocol.endsWith('/');
      if (lastCharacterIsASlash) {
        this.uriOfRemoteSolutionWithoutProtocol = this.uriOfRemoteSolutionWithoutProtocol.slice(0, -1);
      }

      await this.addSolutionToRemoteSolutionHistory(this.uriOfRemoteSolution);

      this.isConnecting = true;
      await this.solutionExplorerList.openSolution(this.uriOfRemoteSolution);
      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;

      const genericMessage: string = `Unable to connect to ProcessEngine on: ${this.uriOfRemoteSolution}`;
      const cause: string = error.message ? error.message : '';

      this.connectionError = `${genericMessage}\n${cause}`;

      return;
    }

    this.closeRemoteSolutionModal();
  }

  /**
   * Handles the file input for the FileSystem Solutions.
   * @param event A event that holds the files that were "uploaded" by the user.
   * Currently there is no type for this kind of event.
   */
  public async onSolutionInputChange(event: IInputEvent): Promise<void> {
    const uri: string = event.target.files[0].path;
    this.solutionInput.value = '';

    this.openSolutionOrDisplayError(uri);
  }

  /**
   * Handles the file input change event for the open file input.
   * @param event An event that holds the files that were "uploaded" by the user.
   * Currently there is no type for this kind of event.
   */
  public async onOpenDiagramInputChange(event: IInputEvent): Promise<void> {
    const uri: string = event.target.files[0].path;
    this.openDiagramInput.value = '';

    return this.openDiagramOrDisplayError(uri);
  }

  public async openDiagram(): Promise<void> {
    const canNotReadFromFileSystem: boolean = !isRunningInElectron();
    if (canNotReadFromFileSystem) {
      this.openDiagramInput.click();

      return;
    }

    this.ipcRenderer.send('open_diagram');

    this.ipcRenderer.once('import_opened_diagram', async (event: Event, openedFile: File) => {
      const noFileSelected: boolean = openedFile === null;
      if (noFileSelected) {
        return;
      }

      const filePath: string = openedFile[0];

      await this.openDiagramOrDisplayError(filePath);
    });
  }

  public async openSolution(): Promise<void> {
    const canNotReadFromFileSystem: boolean = !isRunningInElectron();
    if (canNotReadFromFileSystem) {
      this.solutionInput.click();

      return;
    }

    this.ipcRenderer.send('open_solution');

    this.ipcRenderer.once('import_opened_solution', async (event: Event, openedFolder: File) => {
      const noFolderSelected: boolean = openedFolder === null;
      if (noFolderSelected) {
        return;
      }

      const folderPath: string = openedFolder[0];
      await this.openSolutionOrDisplayError(folderPath);
    });
  }

  public getBadgeForVersion(version: StudioVersion): string {
    switch (version) {
      case StudioVersion.Dev:
        return 'remote-solution-badge__dev';
      case StudioVersion.Alpha:
        return 'remote-solution-badge__alpha';
      case StudioVersion.Beta:
        return 'remote-solution-badge__beta';
      case StudioVersion.Stable:
        return 'remote-solution-badge__stable';
      default:
        return 'remote-solution-badge__dev';
    }
  }

  public getVersionNameForVersion(version: StudioVersion): string {
    switch (version) {
      case StudioVersion.Dev:
        return 'Development';
      case StudioVersion.Alpha:
        return 'BPMN Studio Alpha';
      case StudioVersion.Beta:
        return 'BPMN Studio Beta';
      case StudioVersion.Stable:
        return 'BPMN Studio';
      default:
        return 'Development';
    }
  }

  public selectRemoteSolution(remoteSolutionUri: string): void {
    // tslint:disable-next-line no-magic-numbers
    const protocolEndIndex: number = remoteSolutionUri.indexOf('//') + 2;
    const protocol: string = remoteSolutionUri.substring(0, protocolEndIndex);

    const protocolKey = Object.keys(SupportedProtocols).find((supportedProtocolKey) => {
      return SupportedProtocols[supportedProtocolKey] === protocol;
    });

    const uri: string = remoteSolutionUri.substring(protocolEndIndex, remoteSolutionUri.length);

    this.selectProtocol(SupportedProtocols[protocolKey]);
    this.uriOfRemoteSolutionWithoutProtocol = uri;
  }

  private startPollingOfRemoteSolutionHistoryStatus(): void {
    this.remoteSolutionHistoryStatusIsPolling = true;
    this.pollRemoteSolutionHistoryStatus();
  }

  private pollRemoteSolutionHistoryStatus(): void {
    this.remoteSolutionHistoryStatusPollingTimer = setTimeout(async () => {
      await this.updateRemoteSolutionHistoryStatus();

      if (!this.remoteSolutionHistoryStatusIsPolling) {
        return;
      }

      this.pollRemoteSolutionHistoryStatus();
    }, environment.processengine.updateRemoteSolutionHistoryIntervalInMs);
  }

  private stopPollingOfRemoteSolutionHistoryStatus(): void {
    const noTimerExisting: boolean = this.remoteSolutionHistoryStatusPollingTimer === undefined;
    if (noTimerExisting) {
      return;
    }

    clearTimeout(this.remoteSolutionHistoryStatusPollingTimer);

    this.remoteSolutionHistoryStatusPollingTimer = undefined;
    this.remoteSolutionHistoryStatusIsPolling = false;
  }

  private async updateRemoteSolutionHistoryStatus(): Promise<void> {
    this.remoteSolutionHistoryWithStatus.forEach(
      async (remoteSolutionWithStatus: RemoteSolutionListEntry): Promise<void> => {
        const remoteSolutionStatus: boolean = await this.isRemoteSolutionActive(remoteSolutionWithStatus.uri);

        this.remoteSolutionHistoryStatus.set(remoteSolutionWithStatus.uri, remoteSolutionStatus);
      },
    );
  }

  private async updateDefaultRemoteSolutions(): Promise<void> {
    this.availableDefaultRemoteSolutions = [];

    const stableRemoteSolution: Promise<RemoteSolutionListEntry | null> = this.searchDefaultRemoteSolutionForVersion(
      StudioVersion.Stable,
    );
    const betaRemoteSolution: Promise<RemoteSolutionListEntry | null> = this.searchDefaultRemoteSolutionForVersion(
      StudioVersion.Beta,
    );
    const alphaRemoteSolution: Promise<RemoteSolutionListEntry | null> = this.searchDefaultRemoteSolutionForVersion(
      StudioVersion.Alpha,
    );
    const devRemoteSolution: Promise<RemoteSolutionListEntry | null> = this.searchDefaultRemoteSolutionForVersion(
      StudioVersion.Dev,
    );

    const availableRemoteSolutions: Array<RemoteSolutionListEntry> = await Promise.all([
      stableRemoteSolution,
      betaRemoteSolution,
      alphaRemoteSolution,
      devRemoteSolution,
    ]);

    this.availableDefaultRemoteSolutions = availableRemoteSolutions.filter(
      (remoteSolution: RemoteSolutionListEntry | null) => {
        return remoteSolution !== null;
      },
    );
  }

  private async searchDefaultRemoteSolutionForVersion(version: StudioVersion): Promise<RemoteSolutionListEntry | null> {
    const portsToCheck: Array<number> = getPortListByVersion(version);

    const processEngineUri: string = await this.getActiveProcessEngineForPortList(portsToCheck);

    const noActiveProcessEngineFound: boolean = processEngineUri === null;
    if (noActiveProcessEngineFound) {
      return null;
    }

    return {
      uri: processEngineUri,
      status: true,
      version: version,
    };
  }

  private async getActiveProcessEngineForPortList(portsToCheck: Array<number>): Promise<string | null> {
    for (const port of portsToCheck) {
      const uriToCheck: string = `http://localhost:${port}`;
      const processEngineFound: boolean = await this.isRemoteSolutionActive(uriToCheck);

      if (processEngineFound) {
        return uriToCheck;
      }
    }

    return null;
  }

  private async isRemoteSolutionActive(remoteSolutionUri: string): Promise<boolean> {
    try {
      let response: IResponse<JSON>;
      try {
        response = await this.httpFetchClient.get(`${remoteSolutionUri}/process_engine`);
      } catch (error) {
        const errorIsNotFoundError: boolean = error.code === 404;
        if (errorIsNotFoundError) {
          response = await this.httpFetchClient.get(`${remoteSolutionUri}`);
        } else {
          throw error;
        }
      }

      const isResponseFromProcessEngine: boolean = response.result['name'] === '@process-engine/process_engine_runtime';
      if (!isResponseFromProcessEngine) {
        throw new Error('The response was not send by a ProcessEngine.');
      }

      return true;
    } catch {
      return false;
    }
  }

  private async refreshSolutions(): Promise<void> {
    return this.solutionExplorerList.refreshSolutions();
  }

  private async openSolutionOrDisplayError(uri: string): Promise<void> {
    try {
      await this.solutionExplorerList.openSolution(uri);
    } catch (error) {
      this.notificationService.showNotification(NotificationType.ERROR, error.message);
    }
  }

  private loadRemoteSolutionHistory(): Array<string> {
    const remoteSolutionHistoryFromLocalStorage: string | null = localStorage.getItem('remoteSolutionHistory');
    const noHistoryExisting: boolean = remoteSolutionHistoryFromLocalStorage === null;
    const remoteSolutionHistory: Array<string> = noHistoryExisting
      ? []
      : JSON.parse(remoteSolutionHistoryFromLocalStorage);

    return remoteSolutionHistory;
  }

  private saveRemoteSolutionHistory(remoteSolutionHistory: Array<string>): void {
    const remoteSolutionHistoryString: string = JSON.stringify(remoteSolutionHistory);

    localStorage.setItem('remoteSolutionHistory', remoteSolutionHistoryString);
  }

  private addSolutionToRemoteSolutionHistory(solutionUri: string): void {
    this.removeSolutionFromSolutionHistroy(solutionUri);

    const remoteSolutionHistory: Array<string> = this.loadRemoteSolutionHistory();

    remoteSolutionHistory.push(solutionUri);

    this.saveRemoteSolutionHistory(remoteSolutionHistory);
  }

  private removeSolutionFromSolutionHistroy(solutionUri: string): void {
    const remoteSolutionHistory: Array<string> = this.loadRemoteSolutionHistory();

    const uniqueRemoteSolutionHistory: Array<string> = remoteSolutionHistory.filter((remoteSolutionUri: string) => {
      return remoteSolutionUri !== solutionUri;
    });

    this.saveRemoteSolutionHistory(uniqueRemoteSolutionHistory);
  }

  private async openDiagramOrDisplayError(uri: string): Promise<void> {
    try {
      const openedDiagram: IDiagram = await this.solutionExplorerList.openDiagram(uri);
      const solution: ISolutionEntry = this.solutionExplorerList.getOpenDiagramSolutionEntry();

      this.solutionService.addOpenDiagram(openedDiagram);

      await this.navigateToDetailView(openedDiagram, solution);
    } catch (error) {
      // The diagram may already be opened.
      const diagram: IDiagram | null = await this.solutionExplorerList.getOpenedDiagramByURI(uri);
      const solution: ISolutionEntry = this.solutionExplorerList.getOpenDiagramSolutionEntry();
      const diagramState = this.openDiagramStateService.loadDiagramState(uri);

      const diagramWithURIIsAlreadyOpened: boolean = diagram !== null;
      if (diagramWithURIIsAlreadyOpened) {
        return this.navigateToDetailView(diagram, solution);
      }

      this.notificationService.showNotification(NotificationType.ERROR, error.message);
    }

    return undefined;
  }

  private electronFileOpeningHook = async (_: Event, pathToFile: string): Promise<void> => {
    const uri: string = pathToFile;

    await this.openDiagramOrDisplayError(uri);
  };

  private electronOnMenuOpenDiagramHook = async (_: Event): Promise<void> => {
    this.openDiagram();
  };

  private electronOnMenuOpenSolutionHook = async (_: Event): Promise<void> => {
    this.openSolution();
  };

  private electronOnCreateDiagram = async (_: Event): Promise<void> => {
    await this.openNewDiagram();

    setTimeout(() => {
      const openDiagramsEntry = document.getElementsByClassName('open-diagrams-entry')[0];
      openDiagramsEntry.scrollTop = openDiagramsEntry.scrollHeight;
    }, 0);
  };

  private openNewDiagram(): Promise<void> {
    const uri: string = 'about:open-diagrams';

    return this.solutionExplorerList.createDiagram(uri);
  }

  private createNewDiagram(): void {
    const activeSolutionUri: string = this.router.currentInstruction.queryParams.solutionUri;
    const activeSolution: ISolutionEntry = this.solutionService.getSolutionEntryForUri(activeSolutionUri);

    const activeSolutionCanCreateDiagrams: boolean =
      activeSolution !== undefined && !solutionIsRemoteSolution(activeSolution.uri);

    const uri: string = activeSolutionCanCreateDiagrams ? activeSolutionUri : 'about:open-diagrams';

    this.solutionExplorerList.createDiagram(uri);
  }

  private async registerElectronHooks(): Promise<void> {
    // Register handler for double-click event fired from "electron.js".
    this.ipcRenderer.on('double-click-on-file', this.electronFileOpeningHook);

    this.ipcRenderer.on('menubar__start_opening_diagram', this.electronOnMenuOpenDiagramHook);
    this.ipcRenderer.on('menubar__start_opening_solution', this.electronOnMenuOpenSolutionHook);

    this.ipcRenderer.on('menubar__start_create_diagram', this.electronOnCreateDiagram);

    // Send event to signal the component is ready to handle the event.
    this.ipcRenderer.send('waiting-for-double-file-click');

    // Check if there was a double click before BPMN Studio was loaded.
    const fileInfo: IFile = this.ipcRenderer.sendSync('get_opened_file');

    if (fileInfo.path) {
      // There was a file opened before BPMN Studio was loaded, open it.
      const uri: string = fileInfo.path;
      await this.openDiagramOrDisplayError(uri);
    }
  }

  private removeElectronFileOpeningHooks(): void {
    // Register handler for double-click event fired from "electron.js".
    this.ipcRenderer.removeListener('double-click-on-file', this.electronFileOpeningHook);

    this.ipcRenderer.removeListener('menubar__start_opening_diagram', this.electronOnMenuOpenDiagramHook);
    this.ipcRenderer.removeListener('menubar__start_opening_solution', this.electronOnMenuOpenSolutionHook);

    this.ipcRenderer.removeListener('menubar__start_create_diagram', this.electronOnCreateDiagram);
  }

  private openDiagramOnDropBehaviour: EventListener = async (event: DragEvent): Promise<void> => {
    event.preventDefault();

    const loadedFiles: FileList = event.dataTransfer.files;

    const urisToOpen: Array<string> = Array.from(loadedFiles).map((file: IFile): string => {
      return file.path;
    });

    const openingPromises: Array<Promise<void>> = urisToOpen.map(
      (uri: string): Promise<void> => {
        return this.openDiagramOrDisplayError(uri);
      },
    );

    await Promise.all(openingPromises);
  };

  // TODO: This method is copied all over the place.
  private async navigateToDetailView(diagram: IDiagram, solution: ISolutionEntry): Promise<void> {
    await this.router.navigateToRoute('design', {
      diagramName: diagram.name,
      diagramUri: diagram.uri,
      solutionUri: solution.uri,
    });
  }
}
