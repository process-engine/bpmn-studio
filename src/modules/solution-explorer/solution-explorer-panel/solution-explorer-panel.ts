import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {AuthenticationStateEvent, IFile, IInputEvent, ISolutionEntry, ISolutionService} from '../../../contracts/index';
import {NotificationType} from '../../../contracts/index';
import environment from '../../../environment';
import {NotificationService} from '../../../services/notification-service/notification.service';
import {SolutionExplorerList} from '../solution-explorer-list/solution-explorer-list';

import * as os from 'os';
import * as path from 'path';

/**
 * This component handels:
 *  - Opening files via drag and drop
 *  - Opening files via double click
 *  - Opening solution/diagrams via input field
 *  - Refreshing all opened solutions via button
 *  - Refreshing on login/logout
 *  - Updating the remote processengine uri if needed
 */
@inject(EventAggregator, 'NotificationService', Router, 'SolutionService')
export class SolutionExplorerPanel {

  private _eventAggregator: EventAggregator;
  private _notificationService: NotificationService;
  private _router: Router;
  // TODO: Add typings
  private _ipcRenderer: any | null = null;
  private _subscriptions: Array<Subscription> = [];
  private _solutionService: ISolutionService;

  // Fields below are bound from the html view.
  public solutionExplorerList: SolutionExplorerList;
  public solutionInput: HTMLInputElement;
  public singleDiagramInput: HTMLInputElement;
  public showOpenRemoteSolutionModal: boolean = false;
  public uriOfRemoteSolution: string;
  public solutionExplorerPanel: SolutionExplorerPanel = this;

  constructor(
    eventAggregator: EventAggregator,
    notificationService: NotificationService,
    router: Router,
    solutionService: ISolutionService,
  ) {
    this._eventAggregator = eventAggregator;
    this._notificationService = notificationService;
    this._router = router;
    this._solutionService = solutionService;

    if (this.canReadFromFileSystem()) {
      this._ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
    }
  }

  public async bind(): Promise<void> {
    // Open the solution of the currently configured processengine instance on startup.
    const uriOfProcessEngine: string = window.localStorage.getItem('InternalProcessEngineRoute');

    const persistedInternalSolution: ISolutionEntry = this._solutionService.getSolutionEntryForUri(uriOfProcessEngine);
    const internalSolutionWasPersisted: boolean = persistedInternalSolution !== undefined;
    if (internalSolutionWasPersisted) {
      // Only open the internal solution with the persisted identity when it as persisted.
      await this.solutionExplorerList.openSolution(uriOfProcessEngine, true, persistedInternalSolution.identity);
    } else {
      // Otherwise just open it without an identity.
      await this.solutionExplorerList.openSolution(uriOfProcessEngine);
    }

    // Open the previously opened solutions.
    const previouslyOpenedSolutions: Array<ISolutionEntry> = this._solutionService.getPersistedEntries();
    previouslyOpenedSolutions.forEach(async(entry: ISolutionEntry) => {
      // We are not adding the solution of the connect PE here again since that happened above.
      const entryIsNotConnectedProcessEngine: boolean = entry.uri !== uriOfProcessEngine;
      if (entryIsNotConnectedProcessEngine) {
        /**
         * Since we can't distinguish if the persisted ProcessEngine was an
         * internal or external one yet, we consume any connection error
         * produced by the openSolution method.
         */
        try {
          await this.solutionExplorerList.openSolution(entry.uri, false, entry.identity);
        } catch (error) {

          return;
        }
      }
    });

    const persistedSingleDiagrams: Array<IDiagram> = this._solutionService.getSingleDiagrams();
    persistedSingleDiagrams.forEach(async(diagram: IDiagram) => {
      try {
        await this.solutionExplorerList.openSingleDiagram(diagram.uri);
      } catch (error) {
        this._solutionService.removeSingleDiagramByUri(diagram.uri);
      }
    });

  }

  public async attached(): Promise<void> {
    if (this.canReadFromFileSystem()) {

      this._registerElectronHooks();
      document.addEventListener('drop', this._openDiagramOnDropBehaviour);
    }

    this._subscriptions = [
      this._eventAggregator.subscribe(environment.events.diagramDetail.onDiagramDeployed, async() => {
        await this.solutionExplorerList.refreshSolutions();
      }),
      this._eventAggregator.subscribe(environment.events.startPage.openLocalSolution, () => {
        this.openSolution();
      }),
      this._eventAggregator.subscribe(environment.events.startPage.openSingleDiagram, () => {
        this.openDiagram();
      }),
      this._eventAggregator.subscribe(environment.events.startPage.createSingleDiagram, () => {
        this._createNewDiagram();
      }),
      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, async() => {
        await this.solutionExplorerList.refreshSolutions();
      }),
    ];
  }

  public detached(): void {
    if (this.canReadFromFileSystem()) {

      this._removeElectronFileOpeningHooks();
      document.removeEventListener('drop', this._openDiagramOnDropBehaviour);
    }

    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }

  public openRemoteSolutionModal(): void {
    this.showOpenRemoteSolutionModal = true;
  }

  public closeRemoteSolutionModal(): void {
    this.showOpenRemoteSolutionModal = false;
    this.uriOfRemoteSolution = undefined;
  }

  public async openRemoteSolution(): Promise<void> {
    try {
      const lastCharacterIsASlash: boolean = this.uriOfRemoteSolution.endsWith('/');
      if (lastCharacterIsASlash) {
        this.uriOfRemoteSolution = this.uriOfRemoteSolution.slice(0, -1);
      }

      await this.solutionExplorerList.openSolution(this.uriOfRemoteSolution);
    } catch (error) {
      const genericMessage: string = `Unable to connect to ProcessEngine on: ${this.uriOfRemoteSolution}`;
      const cause: string = error.message ? error.message : '';
      this._notificationService.showNotification(NotificationType.ERROR, `${genericMessage}<br />${cause}`);
    }

    this.uriOfRemoteSolution = undefined;
    this.showOpenRemoteSolutionModal = false;
  }

  /**
   * Handles the file input for the FileSystem Solutions.
   * @param event A event that holds the files that were "uploaded" by the user.
   * Currently there is no type for this kind of event.
   */
  public async onSolutionInputChange(event: IInputEvent): Promise<void> {
    const uri: string = event.target.files[0].path;
    this.solutionInput.value = '';

    this._openSolutionOrDisplayError(uri);
  }

  /**
   * Handles the file input change event for the single file input.
   * @param event An event that holds the files that were "uploaded" by the user.
   * Currently there is no type for this kind of event.
   */
  public async onSingleDiagramInputChange(event: IInputEvent): Promise<void> {
    const uri: string = event.target.files[0].path;
    this.singleDiagramInput.value = '';

    return this._openSingleDiagramOrDisplayError(uri);
  }

  public async openDiagram(): Promise<void> {
    const canNotReadFromFileSystem: boolean = !this.canReadFromFileSystem();
    if (canNotReadFromFileSystem) {
      this.singleDiagramInput.click();

      return;
    }

    this._ipcRenderer.send('open_single_diagram');

    this._ipcRenderer.once('import_opened_single_diagram', async(event: Event, openedFile: File) => {
      const noFileSelected: boolean = openedFile === null;
      if (noFileSelected) {
        return;
      }

      const filePath: string = openedFile[0];

      await this._openSingleDiagramOrDisplayError(filePath);
    });
  }

  public get uriIsValid(): boolean {
    if (this.uriIsEmpty) {
      return true;
    }

    /**
     * This RegEx checks if the entered URI is valid or not.
     */
    const urlRegEx: RegExp = /^(?:http(s)?:\/\/)+[\w.-]?[\w\-\._~:/?#[\]@!\$&\'\(\)\*\+,;=.]+$/g;
    const uriIsValid: boolean = urlRegEx.test(this.uriOfRemoteSolution);

    return uriIsValid;
  }

  public get uriIsEmpty(): boolean {
    const uriIsEmtpy: boolean = this.uriOfRemoteSolution === undefined || this.uriOfRemoteSolution.length === 0;

    return uriIsEmtpy;
  }

  public async openSolution(): Promise<void> {
    const canNotReadFromFileSystem: boolean = !this.canReadFromFileSystem();
    if (canNotReadFromFileSystem) {
      this.solutionInput.click();

      return;
    }

    this._ipcRenderer.send('open_solution');

    this._ipcRenderer.once('import_opened_solution', async(event: Event, openedFolder: File) => {
      const noFolderSelected: boolean = openedFolder === null;
      if (noFolderSelected) {
        return;
      }

      const folderPath: string = openedFolder[0];
      await this._openSolutionOrDisplayError(folderPath);
    });
  }

  public canReadFromFileSystem(): boolean {
    return (window as any).nodeRequire;
  }

  private async _openSolutionOrDisplayError(uri: string): Promise<void> {
    try {
      await this.solutionExplorerList.openSolution(uri);
    } catch (error) {
      this._notificationService.showNotification(NotificationType.ERROR, error.message);
    }
  }

  private async _openSingleDiagramOrDisplayError(uri: string): Promise<void> {
    try {

      const openedDiagram: IDiagram = await this.solutionExplorerList.openSingleDiagram(uri);
      const solution: ISolutionEntry = this.solutionExplorerList.getSingleDiagramSolutionEntry();

      this._solutionService.addSingleDiagram(openedDiagram);

      await this._navigateToDetailView(openedDiagram, solution);

    } catch (error) {
      // The diagram may already be opened.
      const diagram: IDiagram | null = await this.solutionExplorerList.getOpenedSingleDiagramByURI(uri);
      const solution: ISolutionEntry = this.solutionExplorerList.getSingleDiagramSolutionEntry();

      const diagramWithURIIsAlreadyOpened: boolean = diagram !== null;
      if (diagramWithURIIsAlreadyOpened) {
        return this._navigateToDetailView(diagram, solution);
      }

      this._notificationService.showNotification(NotificationType.ERROR, error.message);
    }
  }

  private _electronFileOpeningHook = async(_: Event, pathToFile: string): Promise<void> => {
    const uri: string = pathToFile;
    this._openSingleDiagramOrDisplayError(uri);
  }

  private _electronOnMenuOpenDiagramHook = async(_: Event): Promise<void> => {
    this.openDiagram();
  }

  private _electronOnMenuOpenSolutionHook = async(_: Event): Promise<void> => {
    this.openSolution();
  }

  private _electronOnCreateDiagram = async(_: Event): Promise<void> => {
    this._createNewDiagram();
  }

  private _createNewDiagram(): void {
    const activeSolutionUri: string = this._router.currentInstruction.queryParams.solutionUri;
    const activeSolution: ISolutionEntry = this._solutionService.getSolutionEntryForUri(activeSolutionUri);

    const activeSolutionCanCreateDiagrams: boolean = activeSolution !== undefined
                                                  && !activeSolution.uri.startsWith('http');

    const uri: string = activeSolutionCanCreateDiagrams
                        ? activeSolutionUri
                        : 'Single Diagrams';

    this.solutionExplorerList.createDiagram(uri);
    this.solutionExplorerList.refreshSolutions();
  }

  private _registerElectronHooks(): void {
    // Register handler for double-click event fired from "electron.js".
    this._ipcRenderer.on('double-click-on-file', this._electronFileOpeningHook);

    this._ipcRenderer.on('menubar__start_opening_diagram', this._electronOnMenuOpenDiagramHook);
    this._ipcRenderer.on('menubar__start_opening_solution', this._electronOnMenuOpenSolutionHook);

    this._ipcRenderer.on('menubar__start_create_diagram', this._electronOnCreateDiagram);

    // Send event to signal the component is ready to handle the event.
    this._ipcRenderer.send('waiting-for-double-file-click');

    // Check if there was a double click before BPMN-Studio was loaded.
    const fileInfo: IFile = this._ipcRenderer.sendSync('get_opened_file');

    if (fileInfo.path) {
      // There was a file opened before BPMN-Studio was loaded, open it.
      const uri: string = fileInfo.path;
      this._openSingleDiagramOrDisplayError(uri);
    }
  }

  private _removeElectronFileOpeningHooks(): void {
    // Register handler for double-click event fired from "electron.js".
    this._ipcRenderer.removeListener('double-click-on-file', this._electronFileOpeningHook);

    this._ipcRenderer.removeListener('menubar__start_opening_diagram', this._electronOnMenuOpenDiagramHook);
    this._ipcRenderer.removeListener('menubar__start_opening_solution', this._electronOnMenuOpenSolutionHook);

    this._ipcRenderer.removeListener('menubar__start_create_diagram', this._electronOnCreateDiagram);
  }

  private _openDiagramOnDropBehaviour: EventListener = async(event: DragEvent): Promise<void> => {
    event.preventDefault();

    const loadedFiles: FileList = event.dataTransfer.files;

    const urisToOpen: Array<string> = Array.from(loadedFiles)
      .map((file: IFile): string => {
        return file.path;
      });

    const openingPromises: Array<Promise<void>> = urisToOpen
      .map((uri: string): Promise<void> => {
        return this._openSingleDiagramOrDisplayError(uri);
      });

    await Promise.all(openingPromises);
  }

  // TODO: This method is copied all over the place.
  private async _navigateToDetailView(diagram: IDiagram, solution: ISolutionEntry): Promise<void> {

    await this._router.navigateToRoute('design', {
      diagramName: diagram.name,
      solutionUri: solution.uri,
    });

  }
}
