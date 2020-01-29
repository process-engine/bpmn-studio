/* eslint-disable complexity */
import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {computedFrom, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {SemVer} from 'semver';

import {IIdentity} from '@essential-projects/iam_contracts';
import {IResponse} from '@essential-projects/http_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

import {
  AuthenticationStateEvent,
  IAuthenticationService,
  ILoginResult,
  ISolutionEntry,
  ISolutionService,
  IUserIdentity,
} from '../../../contracts/index';
import {OpenDiagramsSolutionExplorerService} from '../../../services/solution-explorer-services/open-diagrams-solution-explorer.service';
import {SolutionExplorerServiceFactory} from '../../../services/solution-explorer-services/solution-explorer-service-factory';
import {SolutionExplorerSolution} from '../solution-explorer-solution/solution-explorer-solution';
import {exposeFunctionForTesting} from '../../../services/expose-functionality-module/expose-functionality.module';
import {HttpFetchClient} from '../../fetch-http-client/http-fetch-client';
import {solutionIsRemoteSolution} from '../../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';
import {isRunningInElectron} from '../../../services/is-running-in-electron-module/is-running-in-electron.module';
import environment from '../../../environment';

interface IUriToViewModelMap {
  [key: string]: SolutionExplorerSolution;
}

@inject(
  Router,
  EventAggregator,
  'SolutionExplorerServiceFactory',
  'AuthenticationService',
  'SolutionService',
  'OpenDiagramService',
  'HttpFetchClient',
)
export class SolutionExplorerList {
  public loginFunction: Function;
  public internalProcessEngineVersion: string;
  public internalSolutionUri: string;
  public processEngineIsNewerModal: boolean = false;
  public processEngineIsOlderModal: boolean = false;
  /**
   * Reference on the service used to open open diagrams.
   * This service is also put inside the map.
   */
  public openDiagramService: OpenDiagramsSolutionExplorerService;

  public checkIfSolutionIsRemoteSolution: (solutionUri: string) => boolean = solutionIsRemoteSolution;

  /*
   * Keep a seperate map of all viewmodels for the solutions entries.
   * The uri maps to the viewmodel. The contents of this map get set by aurelia
   * in the html view.
   */
  public solutionEntryViewModels: IUriToViewModelMap = {};

  private router: Router;
  private eventAggregator: EventAggregator;
  private solutionExplorerServiceFactory: SolutionExplorerServiceFactory;
  private authenticationService: IAuthenticationService;
  private solutionService: ISolutionService;
  /*
   * Contains all opened solutions.
   */
  private openedSolutions: Array<ISolutionEntry> = [];
  private solutionsToOpen: Array<string> = [];
  private solutionsWhoseOpeningShouldGetAborted: Array<string> = [];
  private pollingTimeout: NodeJS.Timeout;

  private httpFetchClient: HttpFetchClient;

  constructor(
    router: Router,
    eventAggregator: EventAggregator,
    solutionExplorerServiceFactory: SolutionExplorerServiceFactory,
    authenticationService: IAuthenticationService,
    solutionService: ISolutionService,
    openDiagramService: OpenDiagramsSolutionExplorerService,
    httpFetchClient: HttpFetchClient,
  ) {
    this.router = router;
    this.eventAggregator = eventAggregator;
    this.solutionExplorerServiceFactory = solutionExplorerServiceFactory;
    this.authenticationService = authenticationService;
    this.solutionService = solutionService;
    this.openDiagramService = openDiagramService;
    this.httpFetchClient = httpFetchClient;

    const canReadFromFileSystem: boolean = isRunningInElectron();
    if (canReadFromFileSystem) {
      this.createOpenDiagramServiceEntry();
    }

    exposeFunctionForTesting('openSolution', (uri: string, insertAtBeginning?: boolean, identity?: IIdentity): void => {
      this.openSolution(uri, insertAtBeginning, identity);
    });

    this.loginFunction = async (solutionEntry: ISolutionEntry): Promise<void> => {
      await this.login(solutionEntry);
    };

    this.internalSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    this.internalProcessEngineVersion = window.localStorage.getItem('InternalProcessEngineVersion');
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
      .map(
        (viewModel: SolutionExplorerSolution): Promise<void> => {
          return viewModel.updateSolution();
        },
      );

    await Promise.all(refreshPromises);
  }

  public toggleSolution(solutionEntry: ISolutionEntry): void {
    solutionEntry.hidden = !solutionEntry.hidden;
    this.solutionService.persistSolutionsInLocalStorage();
  }

  public solutionIsInternalSolution(solution: ISolutionEntry): boolean {
    const solutionIsInternalSolution: boolean = solution.uri === this.internalSolutionUri;

    return solutionIsInternalSolution;
  }

  public openSettings(): void {
    this.router.navigateToRoute('settings');
  }

  public async openDiagram(uri: string): Promise<IDiagram> {
    const identity: IIdentity = this.createIdentityForSolutionExplorer();

    const diagram: IDiagram = await this.openDiagramService.openDiagram(uri, identity);

    return diagram;
  }

  /**
   * Gets the diagram with the given uri, if the diagram was opened
   * before.
   */
  public getOpenedDiagramByURI(uri: string): IDiagram | null {
    return this.openDiagramService.getOpenedDiagramByURI(uri);
  }

  public getOpenDiagramSolutionEntry(): ISolutionEntry {
    return this.openedSolutions.find((entry: ISolutionEntry) => {
      return entry.uri === 'about:open-diagrams';
    });
  }

  public isProcessEngineNewerThanInternal(solutionEntry: ISolutionEntry): boolean {
    if (this.internalProcessEngineVersion === 'null') {
      return false;
    }

    const internalPEVersion = new SemVer(this.internalProcessEngineVersion);
    const solutionEntryPEVersion = new SemVer(solutionEntry.processEngineVersion);

    return internalPEVersion.major < solutionEntryPEVersion.major;
  }

  public isProcessEngineOlderThanInternal(solutionEntry: ISolutionEntry): boolean {
    if (this.internalProcessEngineVersion === 'null') {
      return false;
    }

    const internalPEVersion = new SemVer(this.internalProcessEngineVersion);
    const solutionEntryPEVersion = new SemVer(solutionEntry.processEngineVersion);

    return internalPEVersion.major > solutionEntryPEVersion.major;
  }

  public showNewerModal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.processEngineIsNewerModal = true;
  }

  public showOlderModal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.processEngineIsOlderModal = true;
  }

  public cancelOpeningSolution(solutionUri: string): void {
    if (this.solutionsToOpen.includes(solutionUri)) {
      this.solutionsWhoseOpeningShouldGetAborted.push(solutionUri);
    }
  }

  public async openSolution(uri: string, insertAtBeginning: boolean = false, identity?: IIdentity): Promise<void> {
    this.solutionsToOpen.push(uri);

    const uriIsRemote: boolean = solutionIsRemoteSolution(uri);

    let solutionExplorer: ISolutionExplorerService;

    if (uriIsRemote) {
      solutionExplorer = await this.solutionExplorerServiceFactory.newManagementApiSolutionExplorer();
    } else {
      solutionExplorer = await this.solutionExplorerServiceFactory.newFileSystemSolutionExplorer();
    }

    const identityIsSet: boolean = identity !== undefined && identity !== null;

    const identityToUse: IIdentity = identityIsSet ? identity : this.createIdentityForSolutionExplorer();

    let processEngineVersion: string;
    const uriIsNotInternalProcessEngine: boolean = this.internalSolutionUri !== uri;

    try {
      if (uriIsRemote && uriIsNotInternalProcessEngine) {
        const response: IResponse<JSON & {version: string}> = await new Promise(
          async (resolve, reject): Promise<void> => {
            const timeout: NodeJS.Timeout = setTimeout(() => {
              if (this.solutionsWhoseOpeningShouldGetAborted.includes(uri)) {
                this.openingSolutionWasCanceled(uri);

                return;
              }

              reject(new Error('Server did not respond.'));
            }, 3000);

            try {
              try {
                const fetchResponse: any = await this.httpFetchClient.get(`${uri}/process_engine`);

                resolve(fetchResponse);
              } catch (error) {
                const errorIsNotFoundError: boolean = error.code === 404;
                if (errorIsNotFoundError) {
                  const fetchResponse: any = await this.httpFetchClient.get(`${uri}`);

                  resolve(fetchResponse);
                } else {
                  reject(error);
                }
              }

              clearTimeout(timeout);
            } catch (error) {
              clearTimeout(timeout);

              reject(error);
            }
          },
        );

        if (this.solutionsWhoseOpeningShouldGetAborted.includes(uri)) {
          this.openingSolutionWasCanceled(uri);

          return;
        }

        const isResponseFromProcessEngine: boolean =
          response.result['name'] === '@process-engine/process_engine_runtime';
        if (!isResponseFromProcessEngine) {
          throw new Error('The response was not send by a ProcessEngine.');
        }

        processEngineVersion = response.result.version;
      }

      const uriIsInternalProcessEngine = !uriIsNotInternalProcessEngine;
      if (uriIsInternalProcessEngine) {
        processEngineVersion = this.internalProcessEngineVersion;
      }

      if (this.solutionsWhoseOpeningShouldGetAborted.includes(uri)) {
        this.openingSolutionWasCanceled(uri);

        return;
      }

      await solutionExplorer.openSolution(uri, identityToUse);

      this.solutionsToOpen.splice(this.solutionsToOpen.indexOf(uri), 1);
    } catch (error) {
      this.solutionsToOpen.splice(this.solutionsToOpen.indexOf(uri), 1);
      this.solutionService.removeSolutionEntryByUri(uri);

      const errorIsNoProcessEngine: boolean =
        error.message === 'The response was not send by a ProcessEngine.' ||
        error.message === 'Unexpected token < in JSON at position 0' ||
        error.message === 'Server did not respond.';
      if (errorIsNoProcessEngine) {
        throw new Error('There is no processengine running on this uri.');
      }

      const openSolutionFailedWithFailedToFetch: boolean = error.message === 'Failed to fetch';
      if (openSolutionFailedWithFailedToFetch) {
        if (!uriIsNotInternalProcessEngine) {
          this.startPollingForInternalEngine(uri, insertAtBeginning, identityToUse);

          return;
        }
        /**
         * TODO: The error message only contains 'Failed to fetch' if the connection
         * failed. A more detailed cause (such as Connection Refused) would
         * be better. This needs to be implemented in the service or repository.
         */
        throw new Error('Failed to receive the list of ProcessModels from the endpoint');
      }

      throw error;
    }

    const solutionURI: string = uri;

    const arrayAlreadyContainedURI: boolean = this.getIndexOfSolution(solutionURI) >= 0;

    if (arrayAlreadyContainedURI) {
      throw new Error('Solution is already opened.');
    }

    this.addSolutionEntry(uri, solutionExplorer, identityToUse, insertAtBeginning, processEngineVersion);
  }

  private startPollingForInternalEngine(uri, insertAtBeginning, identityToUse): void {
    this.pollingTimeout = setTimeout(() => {
      if (this.openedSolutions.some((solution: ISolutionEntry) => solution.uri === uri)) {
        clearTimeout(this.pollingTimeout);
        return;
      }

      this.openSolution(uri, insertAtBeginning, identityToUse);
    }, 400);
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
    const currentOpenDiagram: string = this.router.currentInstruction.queryParams.solutionUri;
    const diagramOfClosedSolutionOpen: boolean = uri.includes(currentOpenDiagram);

    if (diagramOfClosedSolutionOpen) {
      /**
       * We only want to close the open Solution, if the user does not have
       * unsaved changes.
       */
      const subscription: Subscription = this.eventAggregator.subscribe('router:navigation:success', () => {
        this.cleanupSolution(uri);
        subscription.dispose();
      });

      this.router.navigateToRoute('start-page');
    } else {
      this.cleanupSolution(uri);
    }
  }

  public async login(solutionEntry: ISolutionEntry): Promise<void> {
    const onTokenRefresh = async (refreshResult: ILoginResult): Promise<void> => {
      const couldNotConnectToAuthority: boolean = refreshResult === undefined;
      const userIsNotLoggedIn: boolean = refreshResult.idToken === 'access_denied';
      if (couldNotConnectToAuthority || userIsNotLoggedIn) {
        return;
      }

      solutionEntry.identity = {
        token: refreshResult.accessToken,
        userId: refreshResult.idToken,
      };
      solutionEntry.isLoggedIn = true;
      solutionEntry.userName = refreshResult.identity.name;

      await solutionEntry.service.openSolution(solutionEntry.uri, solutionEntry.identity);
      this.solutionService.persistSolutionsInLocalStorage();

      this.eventAggregator.publish(AuthenticationStateEvent.LOGIN);
    };

    const result: ILoginResult = await this.authenticationService.login(
      solutionEntry.authority,
      solutionEntry.uri,
      onTokenRefresh,
    );

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
    this.solutionService.persistSolutionsInLocalStorage();

    this.eventAggregator.publish(AuthenticationStateEvent.LOGIN);
  }

  public async logout(solutionEntry: ISolutionEntry): Promise<void> {
    await this.authenticationService.logout(solutionEntry.authority, solutionEntry.uri, solutionEntry.identity);

    solutionEntry.identity = this.createIdentityForSolutionExplorer();
    solutionEntry.isLoggedIn = false;
    solutionEntry.userName = undefined;

    await solutionEntry.service.openSolution(solutionEntry.uri, solutionEntry.identity);
    this.solutionService.persistSolutionsInLocalStorage();

    this.router.navigateToRoute('start-page');
  }

  /**
   * Starts the creation process of a new diagram inside the given solution
   * entry.
   */
  public async createDiagram(solutionEntryOrUri: any): Promise<void> {
    const hiddenPropertyExists: boolean = solutionEntryOrUri.hidden !== undefined;
    if (hiddenPropertyExists && solutionEntryOrUri.hidden) {
      this.toggleSolution(solutionEntryOrUri);
    }

    const uri: string = solutionEntryOrUri.uri ? solutionEntryOrUri.uri : solutionEntryOrUri;

    let viewModelOfEntry: SolutionExplorerSolution = this.solutionEntryViewModels[uri];

    const solutionIsNotOpened: boolean = viewModelOfEntry === undefined || viewModelOfEntry === null;
    if (solutionIsNotOpened) {
      const uriIsOpenDiagrams: boolean = uri.startsWith('about:open-diagrams');
      if (uriIsOpenDiagrams) {
        this.openDiagramService.isCreatingDiagram = true;
      } else {
        await this.openSolution(uri);
      }
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
      this.openDiagramService.isCreatingDiagram = false;
    }, 0);
  }

  public getSolutionName(solutionUri: string): string {
    const solutionIsRemote: boolean = solutionIsRemoteSolution(solutionUri);
    if (solutionIsRemote) {
      return solutionUri;
    }

    const isOpenDiagrams: boolean = solutionUri === 'about:open-diagrams';
    if (isOpenDiagrams) {
      return 'Open Diagrams';
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
    return solutionIsRemoteSolution(solutionEntry.uri);
  }

  /*
   * Give aurelia a hint on what objects to observe.
   * If we dont do this, it falls back to active pooling which is slow.
   * `openDiagramService._openedDiagrams.length` observed because
   * aurelia cannot see the business rules happening in this._shouldDisplaySolution().
   */
  @computedFrom(
    'openedSolutions.length',
    'openDiagramService.openedDiagrams.length',
    'openDiagramService.isCreatingDiagram',
  )
  public get openedSolutionsToDisplay(): Array<ISolutionEntry> {
    const filteredEntries: Array<ISolutionEntry> = this.openedSolutions.filter(this.shouldDisplaySolution);

    const sortedEntries: Array<ISolutionEntry> = filteredEntries.sort(
      (solutionA: ISolutionEntry, solutionB: ISolutionEntry) => {
        if (solutionA.isOpenDiagram) {
          return -1;
        }

        const solutionAIsInternalProcessEngine: boolean =
          solutionA.uri === window.localStorage.getItem('InternalProcessEngineRoute');
        if (solutionAIsInternalProcessEngine || solutionB.isOpenDiagram) {
          return 1;
        }

        return solutionIsRemoteSolution(solutionA.uri) && !solutionIsRemoteSolution(solutionB.uri) ? 1 : -1;
      },
    );

    return sortedEntries;
  }

  public closeAllOpenDiagrams(): void {
    this.eventAggregator.publish(environment.events.solutionExplorer.closeAllOpenDiagrams);
  }

  private openingSolutionWasCanceled(solutionUri: string): void {
    this.solutionsWhoseOpeningShouldGetAborted.splice(
      this.solutionsWhoseOpeningShouldGetAborted.indexOf(solutionUri),
      1,
    );
    this.solutionsToOpen.splice(this.solutionsToOpen.indexOf(solutionUri), 1);
  }

  private cleanupSolution(uri: string): void {
    const indexOfSolutionToBeRemoved: number = this.getIndexOfSolution(uri);

    const uriNotFound: boolean = indexOfSolutionToBeRemoved < 0;
    if (uriNotFound) {
      return;
    }
    this.openedSolutions.splice(indexOfSolutionToBeRemoved, 1);

    const entryToRemove: ISolutionEntry = this.solutionService.getSolutionEntryForUri(uri);
    this.solutionService.removeSolutionEntryByUri(entryToRemove.uri);
  }
  /**
   * Add entry for single file service.
   */

  private createOpenDiagramServiceEntry(): void {
    const identity: IIdentity = this.createIdentityForSolutionExplorer();

    this.addSolutionEntry('about:open-diagrams', this.openDiagramService, identity, true);
  }

  private getFontAwesomeIconForSolution(service: ISolutionExplorerService, uri: string): string {
    const solutionIsOpenedFromRemote: boolean = solutionIsRemoteSolution(uri);
    if (solutionIsOpenedFromRemote) {
      return 'fa fa-database';
    }

    const solutionIsOpenDiagrams: boolean = service === this.openDiagramService;
    if (solutionIsOpenDiagrams) {
      return 'fa fa-copy';
    }

    return 'fa fa-folder';
  }

  private canCreateNewDiagramsInSolution(service: ISolutionExplorerService, uri: string): boolean {
    const solutionIsNotOpenedFromRemote: boolean = !solutionIsRemoteSolution(uri);
    const solutionIsNotOpenDiagrams: boolean = service !== this.openDiagramService;

    return solutionIsNotOpenedFromRemote && solutionIsNotOpenDiagrams;
  }

  private canCloseSolution(service: ISolutionExplorerService, uri: string): boolean {
    const solutionIsNotOpenDiagrams: boolean = !this.isOpenDiagram(service);

    const internalProcessEngineRoute: string = window.localStorage.getItem('InternalProcessEngineRoute');
    const solutionIsNotInternalSolution: boolean = uri !== internalProcessEngineRoute;

    return solutionIsNotOpenDiagrams && solutionIsNotInternalSolution;
  }

  private isOpenDiagram(service: ISolutionExplorerService): boolean {
    return service === this.openDiagramService;
  }

  private shouldDisplaySolution: (value: ISolutionEntry, index: number, array: Array<ISolutionEntry>) => boolean = (
    entry: ISolutionEntry,
  ): boolean => {
    const service: ISolutionExplorerService = entry.service;

    const isOpenDiagramService: boolean = (service as any).getOpenedDiagrams !== undefined;
    if (isOpenDiagramService) {
      const openDiagramService: OpenDiagramsSolutionExplorerService = service as OpenDiagramsSolutionExplorerService;

      const someDiagramsAreOpened: boolean = openDiagramService.getOpenedDiagrams().length > 0;
      const isCreatingDiagram: boolean = this.openDiagramService.isCreatingDiagram;

      return someDiagramsAreOpened || isCreatingDiagram;
    }

    return true;
  };

  private getIndexOfSolution(uri: string): number {
    const indexOfSolutionWithURI: number = this.openedSolutions.findIndex((element: ISolutionEntry): boolean => {
      return element.uri === uri;
    });

    return indexOfSolutionWithURI;
  }

  private async addSolutionEntry(
    uri: string,
    service: ISolutionExplorerService,
    identity: IIdentity,
    insertAtBeginning: boolean,
    processEngineVersion?: string,
  ): Promise<void> {
    const isOpenDiagram: boolean = this.isOpenDiagram(service);
    const cssIconClass: string = this.getFontAwesomeIconForSolution(service, uri);
    const canCloseSolution: boolean = this.canCloseSolution(service, uri);
    const canCreateNewDiagramsInSolution: boolean = this.canCreateNewDiagramsInSolution(service, uri);
    const authority: string = await this.getAuthorityForSolution(uri);
    const hidden: boolean = this.getHiddenStateForSolutionUri(uri);
    const tooltipText: string = '';
    const isConnected: boolean = true;

    const authorityIsUndefined: boolean = authority === undefined;

    const isLoggedIn: boolean = authorityIsUndefined
      ? false
      : await this.authenticationService.isLoggedIn(authority, identity);

    let userName: string;

    if (isLoggedIn) {
      const userIdentity: IUserIdentity = await this.authenticationService.getUserIdentity(authority, identity);
      userName = userIdentity.name;
    }

    const entry: ISolutionEntry = {
      uri,
      service,
      cssIconClass,
      tooltipText,
      isConnected,
      canCloseSolution,
      canCreateNewDiagramsInSolution,
      isOpenDiagram,
      identity,
      authority,
      isLoggedIn,
      userName,
      processEngineVersion,
      hidden,
    };

    this.solutionService.addSolutionEntry(entry);

    if (insertAtBeginning) {
      this.openedSolutions.splice(1, 0, entry);
    } else {
      this.openedSolutions.push(entry);
    }
  }

  private getHiddenStateForSolutionUri(uri: string): boolean {
    const solutionIsOpenDiagrams: boolean = uri === 'about:open-diagrams';
    if (solutionIsOpenDiagrams) {
      const solutionCollapseState: boolean = JSON.parse(
        window.localStorage.getItem('openDiagramSolutionCollapseState'),
      );
      // eslint-disable-next-line no-unneeded-ternary
      return solutionCollapseState ? solutionCollapseState : false;
    }

    const persistedSolutions: Array<ISolutionEntry> = this.solutionService.getPersistedEntries();
    const solutionToLoad: ISolutionEntry = persistedSolutions.find((solution: ISolutionEntry) => solution.uri === uri);

    if (!solutionToLoad) {
      return false;
    }

    return solutionToLoad.hidden ? solutionToLoad.hidden : false;
  }

  private createIdentityForSolutionExplorer(): IIdentity {
    const accessToken: string = this.createDummyAccessToken();
    // TODO: Get the identity from the IdentityService of `@process-engine/iam`
    const identity: IIdentity = {
      token: accessToken,
      userId: '', // Provided by the IdentityService.
    };

    return identity;
  }

  private async getAuthorityForSolution(solutionUri: string): Promise<string> {
    const solutionIsNotRemote: boolean = !solutionIsRemoteSolution(solutionUri);

    if (solutionIsNotRemote) {
      return undefined;
    }

    try {
      const fetchResponse: any = await this.httpFetchClient.get(`${solutionUri}/process_engine/security/authority`);

      return fetchResponse.result.authority;
    } catch (error) {
      const errorIsNotFoundError: boolean = error.code === 404;
      if (errorIsNotFoundError) {
        const fetchResponse: any = await this.httpFetchClient.get(`${solutionUri}/security/authority`);

        return fetchResponse.result.authority;
      }

      return undefined;
    }
  }

  private createDummyAccessToken(): string {
    const dummyAccessTokenString: string = 'dummy_token';
    const base64EncodedString: string = btoa(dummyAccessTokenString);

    return base64EncodedString;
  }
}
