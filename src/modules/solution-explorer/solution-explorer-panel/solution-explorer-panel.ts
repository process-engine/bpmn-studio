import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {PipelineResult, Router} from 'aurelia-router';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IFile, IInputEvent} from '../../../contracts';
import {AuthenticationStateEvent, NotificationType} from '../../../contracts/index';
import environment from '../../../environment';
import {NotificationService} from '../../notification/notification.service';
import {SolutionExplorerList} from '../solution-explorer-list/solution-explorer-list';

/**
 * This component handels:
 *  - Opening files via drag and drop
 *  - Opening files via double click
 *  - Opening solution/diagrams via input field
 *  - Refreshing all opened solutions via button
 *  - Refreshing on login/logout
 *  - Updating the remote processengine uri if needed
 */
@inject(EventAggregator, 'NotificationService', Router)
export class SolutionExplorerPanel {

  private _eventAggregator: EventAggregator;
  private _notificationService: NotificationService;
  private _router: Router;

  private _subscriptions: Array<Subscription> = [];

  // Fields below are bound from the html view.
  public solutionExplorerList: SolutionExplorerList;
  public solutionInput: HTMLInputElement;
  public singleDiagramInput: HTMLInputElement;

  constructor(
    eventAggregator: EventAggregator,
    notificationService: NotificationService,
    router: Router,
  ) {
    this._eventAggregator = eventAggregator;
    this._notificationService = notificationService;
    this._router = router;
  }

  public async bind(): Promise<void> {
    const uriOfProcessEngine: string = await this._getCurrentlyConfiguredProcessEngineRoute();

    // Open the solution of the currently configured processengine instance on startup.
    await this.solutionExplorerList.openSolution(uriOfProcessEngine);
  }

  public async attached(): Promise<void> {
    if (this.canReadFromFileSystem()) {

      this._registerElectronFileOpeningHooks();
      document.addEventListener('drop', this._openDiagramOnDropBehaviour);
    }

    this._subscriptions = [
      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, () => {
        this.solutionExplorerList.refreshSolutionsOnIdentityChange();
      }),
      this._eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, () => {
        this.solutionExplorerList.refreshSolutionsOnIdentityChange();
      }),
      this._eventAggregator.subscribe(environment.events.configPanel.processEngineRouteChanged,
        async(newRoute: string) => {
          const oldRoute: string = await this._getCurrentlyConfiguredProcessEngineRoute();

          try {
            await this.solutionExplorerList.closeSolution(oldRoute);
          } catch (error) {
            // ignore
          }
          try {
            await this.solutionExplorerList.openSolution(newRoute, true);
          } catch (error) {
            // ignore
          }
        },
      ),
    ];
  }

  public shouldUnsaveCountShown(): boolean {
    return true;
  }

  public countUnsavedSolutions(): number {
    return 1;
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

  /**
   * Handles the file input for the FileSystem Solutions.
   * @param event A event that holds the files that were "uploaded" by the user.
   * Currently there is no type for this kind of event.
   */
  public async onSolutionInputChange(event: IInputEvent): Promise<void> {
    const uri: string = event.target.files[0].path;
    this.solutionInput.value = '';

    try {
      await this.solutionExplorerList.openSolution(uri);
    } catch (error) {
      this._notificationService.showNotification(NotificationType.ERROR, error.message);
    }
  }

  /**
   * Handles the file input change event for the single file input.
   * @param event An event that holds the files that were "uploaded" by the user.
   * Currently there is no type for this kind of event.
   */
  public async onSingleDiagramInputChange(event: IInputEvent): Promise<void> {
    const uri: string = event.target.files[0].path;
    this.singleDiagramInput.value = '';

    return this._openSingleDiagramOrDisplyError(uri);
  }

  public async refreshSolutions(): Promise<void> {
    return this.solutionExplorerList.refreshSolutions();
  }

  public async openDiagram(): Promise<void> {
    this.singleDiagramInput.click();
  }

  public async openSolution(): Promise<void> {
    this.solutionInput.click();
  }

  public canReadFromFileSystem(): boolean {
    return (window as any).nodeRequire;
  }

  private async _openSingleDiagramOrDisplyError(uri: string): Promise<void> {
    try {
      const openedDiagram: IDiagram = await this.solutionExplorerList.openSingleDiagram(uri);
      await this._navigateToDetailView(openedDiagram);

    } catch (error) {
      this._notificationService.showNotification(NotificationType.ERROR, error.message);
    }
  }

  private _electronFileOpeningHook = async(_: Event, pathToFile: string): Promise<void> => {
    const uri: string = pathToFile;
    this._openSingleDiagramOrDisplyError(uri);
  }

  private _registerElectronFileOpeningHooks(): void {
    // TODO: Add typings
    const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;

    // Register handler for double-click event fired from "electron.js".
    ipcRenderer.on('double-click-on-file', this._electronFileOpeningHook);

    // Send event to signal the component is ready to handle the event.
    ipcRenderer.send('waiting-for-double-file-click');

    // Check if there was a double click before BPMN-Studio was loaded.
    const fileInfo: IFile = ipcRenderer.sendSync('get_opened_file');

    if (fileInfo.path) {
      // There was a file opened before BPMN-Studio was loaded, open it.
      const uri: string = fileInfo.path;
      this._openSingleDiagramOrDisplyError(uri);
    }
  }

  private _removeElectronFileOpeningHooks(): void {
    // TODO: Add typings
    const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;

    // Register handler for double-click event fired from "electron.js".
    ipcRenderer.removeListener('double-click-on-file', this._electronFileOpeningHook);
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
        return this._openSingleDiagramOrDisplyError(uri);
      });

    await Promise.all(openingPromises);
  }

  // TODO: Migrate this method once we have a proper config service.
  private async _getCurrentlyConfiguredProcessEngineRoute(): Promise<string> {
    const customProcessEngineRoute: string = window.localStorage.getItem('processEngineRoute');
    const customProcessEngineRouteSet: boolean = customProcessEngineRoute !== ''
                                                 && customProcessEngineRoute !== null
                                                 && customProcessEngineRoute !== undefined;
    if (customProcessEngineRouteSet) {
      return customProcessEngineRoute;
    }

    const internalProcessEngineRoute: string = window.localStorage.getItem('InternalProcessEngineRoute');
    return internalProcessEngineRoute;
  }

  // TODO: This method is copied all over the place.
  private async _navigateToDetailView(diagram: IDiagram): Promise<void> {
    // TODO: Remove this if cause if we again have one detail view.
    const diagramIsOpenedFromRemote: boolean = diagram.uri.startsWith('http');

    if (diagramIsOpenedFromRemote) {
      await this._router.navigateToRoute('processdef-detail', {
        processModelId: diagram.id,
      });

    } else {

      const navigationResult: boolean = await this._router.navigateToRoute('diagram-detail', {
        diagramUri: diagram.uri,
      });

      // This is needed, because navigateToRoute returns an object even though a boolean should be returned
      const navigationSuccessful: boolean = (typeof(navigationResult) === 'boolean')
        ? navigationResult
        : (navigationResult as PipelineResult).completed;

      if (navigationSuccessful) {
        // TODO: This should be moved into the diagram-detail component.
        this._eventAggregator.publish(environment.events.navBar.updateProcess, diagram);
      }
    }
  }
}
