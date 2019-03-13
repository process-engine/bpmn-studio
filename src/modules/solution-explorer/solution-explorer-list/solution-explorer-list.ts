import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {computedFrom, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IIdentity} from '@essential-projects/iam_contracts';
import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

import {
  IAuthenticationService,
  IDiagramValidationService,
  ILoginResult,
  ISolutionEntry,
  ISolutionService,
  IUserIdentity,
  SolutionStatus,
} from '../../../contracts';
import {SingleDiagramsSolutionExplorerService} from '../../../services/solution-explorer-services/SingleDiagramsSolutionExplorerService';
import {SolutionExplorerServiceFactory} from '../../../services/solution-explorer-services/SolutionExplorerServiceFactory';
import {SolutionExplorerSolution} from '../solution-explorer-solution/solution-explorer-solution';

interface IUriToViewModelMap {
  [key: string]: SolutionExplorerSolution;
}

@inject(Router, EventAggregator, 'SolutionExplorerServiceFactory', 'AuthenticationService', 'DiagramValidationService', 'SolutionService')
export class SolutionExplorerList {
  public internalSolutionUri: string;

  private _router: Router;
  private _eventAggregator: EventAggregator;
  private _solutionExplorerServiceFactory: SolutionExplorerServiceFactory;
  private _authenticationService: IAuthenticationService;
  private _diagramValidationService: IDiagramValidationService;
  private _solutionService: ISolutionService;
  /*
   * Contains all opened solutions.
   */
  private _openedSolutions: Array<ISolutionEntry> = [];
  /**
   * Reference on the service used to open single diagrams.
   * This service is also put inside the map.
   */
  private _singleDiagramService: SingleDiagramsSolutionExplorerService;
  /*
   * Keep a seperate map of all viewmodels for the solutions entries.
   * The uri maps to the viewmodel. The contents of this map get set by aurelia
   * in the html view.
   */
  public solutionEntryViewModels: IUriToViewModelMap = {};

  constructor(
    router: Router,
    eventAggregator: EventAggregator,
    solutionExplorerServiceFactory: SolutionExplorerServiceFactory,
    authenticationService: IAuthenticationService,
    diagramValidationService: IDiagramValidationService,
    solutionService: ISolutionService,
  ) {
    this._router = router;
    this._eventAggregator = eventAggregator;
    this._solutionExplorerServiceFactory = solutionExplorerServiceFactory;
    this._authenticationService = authenticationService;
    this._diagramValidationService = diagramValidationService;
    this._solutionService = solutionService;

    const canReadFromFileSystem: boolean = (window as any).nodeRequire;
    if (canReadFromFileSystem) {
      this._createSingleDiagramServiceEntry();
    }

    // Allows us to debug the solution explorer list.
    (window as any).solutionList = this;

    this.internalSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
  }

  /**
   * Refreshes all currently opened solutions.
   */
  public async refreshSolutions(): Promise<void> {
    const refreshPromises: Array<Promise<void>> = Object.values(this.solutionEntryViewModels)
      .filter((viewModel: SolutionExplorerSolution): boolean => {
        const viewModelExists: boolean = viewModel !== undefined && viewModel !== null;
        return viewModelExists;
      })
      .map((viewModel: SolutionExplorerSolution): Promise<void> => {
        return viewModel.updateSolution();
      });

    await Promise.all(refreshPromises);
  }

  public solutionIsInternalSolution(solution: ISolutionEntry): boolean {
    const solutionIsInternalSolution: boolean = solution.uri === this.internalSolutionUri;

    return solutionIsInternalSolution;
  }

  public openSettings(): void {
    this._router.navigateToRoute('settings');
  }

  public async openSingleDiagram(uri: string): Promise<IDiagram> {
    const identity: IIdentity = this._createIdentityForSolutionExplorer();

    const diagram: IDiagram = await this._singleDiagramService.openSingleDiagram(uri, identity);

    return diagram;
  }

  /**
   * Gets the single diagram with the given uri, if the diagram was opened
   * before.
   */
  public getOpenedSingleDiagramByURI(uri: string): IDiagram | null {
    return this._singleDiagramService.getOpenedDiagramByURI(uri);
  }

  public getSingleDiagramSolutionEntry(): ISolutionEntry {
    return this._openedSolutions.find((entry: ISolutionEntry) => {
      return entry.uri === 'Single Diagrams';
    });
  }

  public async openSolution(uri: string, insertAtBeginning: boolean = false, identity?: IIdentity): Promise<void> {
    const uriIsRemote: boolean = uri.startsWith('http');

    let solutionExplorer: ISolutionExplorerService;

    if (uriIsRemote) {
      solutionExplorer = await this._solutionExplorerServiceFactory.newManagementApiSolutionExplorer();
    } else {
      solutionExplorer = await this._solutionExplorerServiceFactory.newFileSystemSolutionExplorer();
    }

    const identityIsNotSet: boolean = identity === undefined || identity === null;
    if (identityIsNotSet) {
      identity = this._createIdentityForSolutionExplorer();
    }

    let processEngineVersion: string;
    try {
      await solutionExplorer.openSolution(uri, identity);

      if (uriIsRemote) {
        const response: Response = await fetch(uri);
        const responseJSON: object & {version: string} = await response.json();

        processEngineVersion = responseJSON.version;
      }
    } catch (error) {

      this._solutionService.removeSolutionEntryByUri(uri);

      /**
       * TODO: The error message only contains 'Failed to fetch' if the connection
       * failed. A more detailed cause (such as Connection Refused) would
       * be better. This needs to be implemented in the service or repository.
       */
      throw new Error('Failed to receive the list of ProcessModels from the endpoint');
    }

    const newOpenedSolution: ISolution = await solutionExplorer.loadSolution();
    const solutionURI: string = newOpenedSolution.uri;

    const arrayAlreadyContainedURI: boolean = this._getIndexOfSolution(solutionURI) >= 0;

    if (arrayAlreadyContainedURI) {
      throw new Error('Solution is already opened.');
    }

    this._addSolutionEntry(uri, solutionExplorer, identity, insertAtBeginning, processEngineVersion);
  }

  /**
   * Closes a solution, if the uri is currently not opened, nothing will
   * happen.
   *
   * @param uri the uri of the solution to close.
   */
  public async closeSolution(uri: string): Promise<void> {

    /**
     * If the user closes the Solution which contains the diagram, which he still
     * has opened, he gets navigated to the start page.
     */
    const currentOpenDiagram: string = this._router.currentInstruction.queryParams.solutionUri;
    const diagramOfClosedSolutionOpen: boolean = uri.includes(currentOpenDiagram);

    if (diagramOfClosedSolutionOpen) {
      /**
       * We only want to close the open Solution, if the user does not have
       * unsaved changes.
       */
      const subscription: Subscription = this._eventAggregator.subscribe('router:navigation:success', () => {
        this._cleanupSolution(uri);
        subscription.dispose();
      });

      this._router.navigateToRoute('start-page');

    } else {
      this._cleanupSolution(uri);
    }
  }

  public async login(solutionEntry: ISolutionEntry): Promise<void> {
    const result: ILoginResult = await this._authenticationService.login(solutionEntry.authority);

    const couldNotConnectToAuthority: boolean = result === undefined;
    if (couldNotConnectToAuthority) {

      return;
    }

    const userIsNotLoggedIn: boolean = result.idToken === 'access_denied';
    if (userIsNotLoggedIn) {

      return;
    }

    const identity: IIdentity = {
      token: result.accessToken,
      userId: result.idToken,
    };

    solutionEntry.identity = identity;
    solutionEntry.isLoggedIn = true;
    solutionEntry.userName = result.identity.name;

    await solutionEntry.service.openSolution(solutionEntry.uri, solutionEntry.identity);
    this._solutionService.persistSolutionsInLocalStorage();

    this._router.navigateToRoute('start-page');
  }

  public async logout(solutionEntry: ISolutionEntry): Promise<void> {
    await this._authenticationService.logout(solutionEntry.authority, solutionEntry.identity);

    solutionEntry.identity = this._createIdentityForSolutionExplorer();
    solutionEntry.isLoggedIn = false;
    solutionEntry.userName = undefined;

    await solutionEntry.service.openSolution(solutionEntry.uri, solutionEntry.identity);
    this._solutionService.persistSolutionsInLocalStorage();

    this._router.navigateToRoute('start-page');
  }

  /**
   * Starts the creation process of a new diagram inside the given solution
   * entry.
   */
  public async createDiagram(uri: string): Promise<void> {
    let viewModelOfEntry: SolutionExplorerSolution = this.solutionEntryViewModels[uri];

    const solutionIsNotOpened: boolean = viewModelOfEntry === undefined || viewModelOfEntry === null;
    if (solutionIsNotOpened) {
      await this.openSolution(uri);
    }

    /**
     * Waiting for next tick of the browser here because the new solution wouldn't
     * be added if we wouldn't do that.
     */
    window.setTimeout(() => {
      if (solutionIsNotOpened) {
        viewModelOfEntry = this.solutionEntryViewModels[uri];
      }

      viewModelOfEntry.startCreationOfNewDiagram();
    }, 0);
  }

  public getSolutionName(solutionUri: string): string {
    const solutionIsRemote: boolean = solutionUri.startsWith('http');
    if (solutionIsRemote) {
      return solutionUri;
    }

    const lastIndexOfSlash: number = solutionUri.lastIndexOf('/');
    const lastIndexOfBackSlash: number = solutionUri.lastIndexOf('\\');
    const lastFolderIndex: number = Math.max(lastIndexOfSlash, lastIndexOfBackSlash) + 1;

    const solutionName: string = solutionUri.substring(lastFolderIndex);

    const solutionNameIsEmpty: boolean = solutionName.length === 0;
    if (solutionNameIsEmpty) {
      return solutionUri;
    }

    return solutionName;
  }

  public solutionEntryIsRemote(solutionEntry: ISolutionEntry): boolean {
    return solutionEntry.uri.startsWith('http');
  }

  /*
   * Give aurelia a hint on what objects to observe.
   * If we dont do this, it falls back to active pooling which is slow.
   * `_singleDiagramService._openedDiagrams.length` observed because
   * aurelia cannot see the business rules happening in this._shouldDisplaySolution().
   */
  @computedFrom('_openedSolutions.length', '_singleDiagramService._openedDiagrams.length')
  public get openedSolutions(): Array<ISolutionEntry> {
    const filteredEntries: Array<ISolutionEntry> = this._openedSolutions
      .filter(this._shouldDisplaySolution);

    const sortedEntries: Array<ISolutionEntry> = filteredEntries.sort((solutionA: ISolutionEntry, solutionB: ISolutionEntry) => {
      if (solutionA.isSingleDiagramService) {
        return -1;
      }

      const solutionAIsInternalProcessEngine: boolean = solutionA.uri === window.localStorage.getItem('InternalProcessEngineRoute');
      if (solutionAIsInternalProcessEngine) {
        return -1;
      }

      return solutionA.uri.startsWith('http') && !solutionB.uri.startsWith('http')
              ? -1
              : 1;
    });

    return sortedEntries;
  }

  private _cleanupSolution(uri: string): void {
   const indexOfSolutionToBeRemoved: number = this._getIndexOfSolution(uri);

   const uriNotFound: boolean = indexOfSolutionToBeRemoved < 0;
   if (uriNotFound) {

      return;
    }
   this._openedSolutions.splice(indexOfSolutionToBeRemoved, 1);

   const entryToRemove: ISolutionEntry = this._solutionService.getSolutionEntryForUri(uri);
   this._solutionService.removeSolutionEntryByUri(entryToRemove.uri);
  }
  /**
   * Add entry for single file service.
   */
  private async _createSingleDiagramServiceEntry(): Promise<void> {

    const fileSystemSolutionExplorer: ISolutionExplorerService = await this._solutionExplorerServiceFactory.newFileSystemSolutionExplorer();

    const uriOfSingleDiagramService: string = 'Single Diagrams';
    const nameOfSingleDiagramService: string = 'Single Diagrams';

    this._singleDiagramService = new SingleDiagramsSolutionExplorerService(
        this._diagramValidationService,
        fileSystemSolutionExplorer,
        uriOfSingleDiagramService,
        nameOfSingleDiagramService,
        this._solutionService,
      );

    const identity: IIdentity = this._createIdentityForSolutionExplorer();

    this._addSolutionEntry(uriOfSingleDiagramService, this._singleDiagramService, identity, true);
  }

  private async _getSolutionStatus(service: ISolutionExplorerService, uri: string): Promise<SolutionStatus> {
    const solutionIsOpenedFromRemote: boolean = uri.startsWith('http');
    if (solutionIsOpenedFromRemote) {
      try {
        await fetch(uri);
        return 'remote';
      } catch {
        return 'disconnected';
      }
    }

    const solutionIsSingleDiagrams: boolean = service === this._singleDiagramService;
    if (solutionIsSingleDiagrams) {
      return 'singleDiagram';
    }

    return 'folder';
  }

  private _canCreateNewDiagramsInSolution(service: ISolutionExplorerService, uri: string): boolean {
    const solutionIsNotOpenedFromRemote: boolean = !uri.startsWith('http');
    const solutionIsNotSingleDiagrams: boolean = service !== this._singleDiagramService;

    return solutionIsNotOpenedFromRemote && solutionIsNotSingleDiagrams;
  }

  private _canCloseSolution(service: ISolutionExplorerService, uri: string): boolean {
    const solutionIsNotSingleDiagrams: boolean = !this._isSingleDiagramService(service);

    const internalProcessEngineRoute: string = window.localStorage.getItem('InternalProcessEngineRoute');
    const solutionIsNotInternalSolution: boolean = uri !== internalProcessEngineRoute;

    return solutionIsNotSingleDiagrams && solutionIsNotInternalSolution;
  }

  private _isSingleDiagramService(service: ISolutionExplorerService): boolean {
    return service === this._singleDiagramService;
  }

  /**
   * Wherever to display that solution entry. Some entries are not display if
   * empty. This method capsules this logic.
   */
  private _shouldDisplaySolution(entry: ISolutionEntry): boolean {
    const service: ISolutionExplorerService = entry.service;

    const isSingleDiagramService: boolean = (service as any).getOpenedDiagrams !== undefined;
    if (isSingleDiagramService) {
      const singleDiagramService: SingleDiagramsSolutionExplorerService = service as SingleDiagramsSolutionExplorerService;

      const someDiagramsAreOpened: boolean = singleDiagramService.getOpenedDiagrams().length > 0;

      return someDiagramsAreOpened;
    }

    return true;
  }

  private _getIndexOfSolution(uri: string): number {
    const indexOfSolutionWithURI: number = this._openedSolutions.findIndex((element: ISolutionEntry): boolean => {
      return element.uri === uri;
    });

    return indexOfSolutionWithURI;
  }

  private async _addSolutionEntry(
    uri: string,
    service: ISolutionExplorerService,
    identity: IIdentity,
    insertAtBeginning: boolean,
    processEngineVersion?: string,
  ): Promise<void> {

    const isSingleDiagramService: boolean = this._isSingleDiagramService(service);
    const status: SolutionStatus = await this._getSolutionStatus(service, uri);
    const canCloseSolution: boolean = this._canCloseSolution(service, uri);
    const canCreateNewDiagramsInSolution: boolean = this._canCreateNewDiagramsInSolution(service, uri);
    const authority: string = await this._getAuthorityForSolution(uri);

    const authorityIsUndefined: boolean = authority === undefined;

    const isLoggedIn: boolean = authorityIsUndefined
                                ? false
                                : await this._authenticationService.isLoggedIn(authority, identity);

    let userName: string;

    if (isLoggedIn) {
      const userIdentity: IUserIdentity = await this._authenticationService.getUserIdentity(authority, identity);
      userName = userIdentity.name;
    }

    const entry: ISolutionEntry = {
      uri,
      service,
      status,
      canCloseSolution,
      canCreateNewDiagramsInSolution,
      isSingleDiagramService,
      identity,
      authority,
      isLoggedIn,
      userName,
      processEngineVersion,
    };

    this._solutionService.addSolutionEntry(entry);

    if (insertAtBeginning) {
      this._openedSolutions.splice(1, 0, entry);
    } else {
      this._openedSolutions.push(entry);
    }
  }

  private _createIdentityForSolutionExplorer(): IIdentity {

    const accessToken: string = this._createDummyAccessToken();
    // TODO: Get the identity from the IdentityService of `@process-engine/iam`
    const identity: IIdentity = {
      token: accessToken,
      userId: '', // Provided by the IdentityService.
    };

    return identity;
  }

  private async _getAuthorityForSolution(solutionUri: string): Promise<string> {
    const solutionIsRemote: boolean = solutionUri.startsWith('http');

    if (solutionIsRemote) {
      const request: Request = new Request(`${solutionUri}/security/authority`, {
        method: 'GET',
        mode: 'cors',
        referrer: 'no-referrer',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });

      const response: Response = await fetch(request);
      const authority: string = (await response.json()).authority;

      return authority;
    }

  }

  private _createDummyAccessToken(): string {
    const dummyAccessTokenString: string = 'dummy_token';
    const base64EncodedString: string = btoa(dummyAccessTokenString);

    return base64EncodedString;
  }

}
