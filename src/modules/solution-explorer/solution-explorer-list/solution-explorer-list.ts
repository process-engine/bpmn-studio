import {computedFrom, inject, observable} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';
import {IDiagram, ISolution} from '@process-engine/solutionexplorer.contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

import {
  IAuthenticationService,
  IDiagramValidationService,
} from '../../../contracts';
import {SingleDiagramsSolutionExplorerService} from '../../solution-explorer-services/SingleDiagramsSolutionExplorerService';
import {SolutionExplorerServiceFactory} from '../../solution-explorer-services/SolutionExplorerServiceFactory';
import {SolutionExplorerSolution} from '../solution-explorer-solution/solution-explorer-solution';

/**
 * This entry keeps information about an opened solution. Its used to support
 * the html view and give an easy access to properties like the uri of the
 * solution.
 */
interface ISolutionEntry {
  service: ISolutionExplorerService;
  uri: string;
  fontAwesomeIconClass: string;
  isSingleDiagramService: boolean;
  canCloseSolution: boolean;
  canCreateNewDiagramsInSolution: boolean;
}

interface IUriToViewModelMap {
  [key: string]: SolutionExplorerSolution;
}

@inject('SolutionExplorerServiceFactory', 'AuthenticationService', 'DiagramValidationService')
export class SolutionExplorerList {

  private _solutionExplorerServiceFactory: SolutionExplorerServiceFactory;
  private _authenticationService: IAuthenticationService;
  private _diagramValidationService: IDiagramValidationService;
  /*
   * Contains all opened solutions.
   */
  @observable private _openedSolutions: Array<ISolutionEntry> = [];
  /**
   * Reference on the service used to open single diagrams.
   * This service is also put inside the map.
   */
  private _singleDiagramService: SingleDiagramsSolutionExplorerService;

  private _lastClickedSolutionIndex: number = -1;
  @observable private _shouldDisplaySwapIcon: boolean = false;

  /*
   * Keep a seperate map of all viewmodels for the solutions entries.
   * The uri maps to the viewmodel. The contents of this map get set by aurelia
   * in the html view.
   */
  public solutionEntryViewModels: IUriToViewModelMap = {};

  constructor(
    solutionExplorerServiceFactory: SolutionExplorerServiceFactory,
    authenticationService: IAuthenticationService,
    diagramValidationService: IDiagramValidationService,
  ) {
    this._solutionExplorerServiceFactory = solutionExplorerServiceFactory;
    this._authenticationService = authenticationService;
    this._diagramValidationService = diagramValidationService;

    const canReadFromFileSystem: boolean = (window as any).nodeRequire;
    if (canReadFromFileSystem) {
      this._createSingleDiagramServiceEntry();
    }

    // Allows us to debug the solution explorer list.
    (window as any).solutionList = this;
  }

  @computedFrom('_shouldDisplaySwapIcon')
  public get shouldDisplaySwapIcon(): boolean {
    return this._shouldDisplaySwapIcon;
  }

  public moveSelection(solutionEntry: ISolutionEntry, event: Event): void {
    const clickedElement: HTMLElement = event.target as HTMLElement;
    const clickedElementClassList: DOMTokenList = clickedElement.classList;
    const userClickedOnHeader: boolean =
      clickedElementClassList.contains('solution-entry__header__name')
    || clickedElementClassList.contains('solution-entry__header__icon');

    /*tslint:disable:no-magic-numbers*/
    const oneSolutionOpened: boolean = this._openedSolutions.length === 2;

    if (!userClickedOnHeader || oneSolutionOpened) {
      this._shouldDisplaySwapIcon = false;
      return;
    }

    const clickedSolutionIndex: number = this._getIndexOfSolution(solutionEntry.uri);
    const userSelectsFirstCard: boolean = this._lastClickedSolutionIndex === -1;

    if (userSelectsFirstCard) {
      this._lastClickedSolutionIndex = clickedSolutionIndex;
      this._shouldDisplaySwapIcon = true;
    } else {
      this._swapSolutions(this._lastClickedSolutionIndex, clickedSolutionIndex);
      this._lastClickedSolutionIndex = -1;
      this._shouldDisplaySwapIcon = false;
    }
  }

  /**
   * Reopen all currently opened solutions to reload the identity
   * used to open the solution.
   */
  public async refreshSolutionsOnIdentityChange(): Promise<void> {
    const openPromises: Array<Promise<void>> = this._openedSolutions
      .map((entry: ISolutionEntry): Promise<void> => {
        return entry.service.openSolution(entry.uri, this._createIdentityForSolutionExplorer());
      });

    await Promise.all(openPromises);

    return this.refreshSolutions();
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

  public async openSingleDiagram(uri: string): Promise<IDiagram> {
    const identity: IIdentity = this._createIdentityForSolutionExplorer();

    return this._singleDiagramService.openSingleDiagram(uri, identity);
  }

  /**
   * Gets the single diagram with the given uri, if the diagram was opened
   * before.
   */
  public getOpenedSingleDiagramByURI(uri: string): IDiagram | null {
    return this._singleDiagramService.getOpenedDiagramByURI(uri);
  }

  public async openSolution(uri: string, insertAtBeginning: boolean = false): Promise<void> {
    const uriIsRemote: boolean = uri.startsWith('http');

    let solutionExplorer: ISolutionExplorerService;
    if (uriIsRemote) {
      solutionExplorer = await this._solutionExplorerServiceFactory.newManagementApiSolutionExplorer();
    } else {
      solutionExplorer = await this._solutionExplorerServiceFactory.newFileSystemSolutionExplorer();
    }

    const identity: IIdentity = this._createIdentityForSolutionExplorer();
    await solutionExplorer.openSolution(uri, identity);

    const newOpenedSpluton: ISolution = await solutionExplorer.loadSolution();
    const solutionURI: string = newOpenedSpluton.uri;

    const arrayAlreadyContainedURI: boolean = this._getIndexOfSolution(solutionURI) >= 0;

    if (arrayAlreadyContainedURI) {
      throw new Error('Solution is already opened.');
    }

    this._addSolutionEntry(uri, solutionExplorer, insertAtBeginning);
  }

  /**
   * Closes a solution, if the uri is currently not opened, nothing will
   * happen.
   *
   * @param uri the uri of the solution to close.
   */
  public async closeSolution(uri: string): Promise<void> {
    const indexOfSolutionToBeRemoved: number = this._getIndexOfSolution(uri);

    const uriNotFound: boolean = indexOfSolutionToBeRemoved < 0;
    if (uriNotFound) {
      return;
    }

    this._openedSolutions.splice(indexOfSolutionToBeRemoved, 1);
  }

  /**
   * Starts the creation process of a new diagram inside the given solution
   * entry.
   */
  public async createDiagram(uri: string): Promise<void> {
    const viewModelOfEntry: SolutionExplorerSolution = this.solutionEntryViewModels[uri];

    return viewModelOfEntry.startCreationOfNewDiagram();
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

    return filteredEntries;
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
      );

    this._addSolutionEntry(uriOfSingleDiagramService, this._singleDiagramService, true);
  }

  private _getFontAwesomeIconForSolution(service: ISolutionExplorerService, uri: string): string {
    const solutionIsOpenedFromRemote: boolean = uri.startsWith('http');
    if (solutionIsOpenedFromRemote) {
      return 'fa-database';
    }

    const solutionIsSingleDiagrams: boolean = service === this._singleDiagramService;
    if (solutionIsSingleDiagrams) {
      return 'fa-copy';
    }

    return 'fa-folder';
  }

  private _canCreateNewDiagramsInSolution(service: ISolutionExplorerService, uri: string): boolean {
    const solutionIsNotOpenedFromRemote: boolean = !uri.startsWith('http');
    const solutionIsNotSingleDiagrams: boolean = service !== this._singleDiagramService;

    return solutionIsNotOpenedFromRemote && solutionIsNotSingleDiagrams;
  }

  private _canCloseSolution(service: ISolutionExplorerService, uri: string): boolean {
    const solutionIsNotSingleDiagrams: boolean = !this._isSingleDiagramService(service);
    const solutionIsNotConnectedProcessEngine: boolean = !uri.startsWith('http');

    return solutionIsNotSingleDiagrams && solutionIsNotConnectedProcessEngine;
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

  private _addSolutionEntry(uri: string, service: ISolutionExplorerService, insertAtBeginning: boolean): void {
    const isSingleDiagramService: boolean = this._isSingleDiagramService(service);
    const fontAwesomeIconClass: string = this._getFontAwesomeIconForSolution(service, uri);
    const canCloseSolution: boolean = this._canCloseSolution(service, uri);
    const canCreateNewDiagramsInSolution: boolean = this._canCreateNewDiagramsInSolution(service, uri);

    const entry: ISolutionEntry = {
      uri,
      service,
      fontAwesomeIconClass,
      canCloseSolution,
      canCreateNewDiagramsInSolution,
      isSingleDiagramService,
    };

    if (insertAtBeginning) {
      this._openedSolutions.splice(1, 0, entry);
    } else {
      this._openedSolutions.push(entry);
    }
  }

  private _createIdentityForSolutionExplorer(): IIdentity {
    const accessToken: string = this._authenticationService.getAccessToken();
    const identity: IIdentity = {
      token: accessToken,
    };

    return identity;
  }

  private _swapSolutions(firstIndex: number, secondIndex: number): void {
    const tempSolution: ISolutionEntry = this._openedSolutions[secondIndex];

    this._openedSolutions.splice(secondIndex, 1, this._openedSolutions[firstIndex]);
    this._openedSolutions.splice(firstIndex, 1, tempSolution);
  }
}
