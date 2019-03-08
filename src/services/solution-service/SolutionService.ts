import {inject} from 'aurelia-framework';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {ISolutionEntry, ISolutionService} from '../../contracts';
import {SolutionExplorerServiceFactory} from '../solution-explorer-services/SolutionExplorerServiceFactory';

@inject('SolutionExplorerServiceFactory')
export class SolutionService implements ISolutionService {
  private _allSolutionEntries: Array<ISolutionEntry> = [];
  private _serviceFactory: SolutionExplorerServiceFactory;
  private _persistedEntries: Array<ISolutionEntry> = [];
  private _persistedSingleDiagrams: Array<IDiagram> = [];

  constructor(serviceFactory: SolutionExplorerServiceFactory) {
    this._serviceFactory = serviceFactory;

    const openedSolutions: Array<ISolutionEntry> = this._getSolutionFromLocalStorage();
    this._persistedSingleDiagrams = this._getSingleDiagramsFromLocalStorage();

    const openedSolutionsAreNotSet: boolean = openedSolutions === null;
    if (openedSolutionsAreNotSet) {
      return;
    }

    openedSolutions.forEach(async(solution: ISolutionEntry) => {
      const solutionIsRemote: boolean = solution.uri.startsWith('http');

      solution.service = solutionIsRemote
        ? await this._serviceFactory.newManagementApiSolutionExplorer()
        : await this._serviceFactory.newFileSystemSolutionExplorer();
    });

    this._persistedEntries = openedSolutions;
    this._allSolutionEntries = this._allSolutionEntries.concat(openedSolutions);
  }

  /**
   * SOLUTIONS
   */

  public addSolutionEntry(solutionEntry: ISolutionEntry): void {

    const solutionWithSameUri: ISolutionEntry = this._allSolutionEntries.find((entry: ISolutionEntry) => {
      const entryHasSameUri: boolean = entry.uri === solutionEntry.uri;

      return entryHasSameUri;
    });
    const solutionIsAlreadyOpenend: boolean = solutionWithSameUri !== undefined;
    if (solutionIsAlreadyOpenend) {
      this.removeSolutionEntryByUri(solutionWithSameUri.uri);
    }

    this._allSolutionEntries.push(solutionEntry);
    this.persistSolutionsInLocalStorage();
  }

  public getPersistedEntries(): Array<ISolutionEntry> {
    return this._persistedEntries;
  }

  public getSolutionEntryForUri(uri: string): ISolutionEntry {
    const solutionEntry: ISolutionEntry = this._allSolutionEntries.find((entry: ISolutionEntry) => {
      const entryUriIsSearchedUri: boolean = entry.uri === uri;

      return entryUriIsSearchedUri;
    });

    return solutionEntry;
  }

  public getRemoteSolutionEntries(): Array<ISolutionEntry> {
    const remoteEntries: Array<ISolutionEntry> = this._allSolutionEntries.filter((entry: ISolutionEntry) => {
      return entry.uri.startsWith('http');
    });

    return remoteEntries;
  }

  public getAllSolutionEntries(): Array<ISolutionEntry> {
    return this._allSolutionEntries;
  }

  public removeSolutionEntryByUri(uri: string): void {
    const solutionToRemove: ISolutionEntry = this._allSolutionEntries.find((entry: ISolutionEntry) => {
      return entry.uri === uri;
    });

    const solutionNotFound: boolean = solutionToRemove === undefined;
    if (solutionNotFound) {
      return;
    }

    this._allSolutionEntries.splice(this._allSolutionEntries.indexOf(solutionToRemove), 1);
    this.persistSolutionsInLocalStorage();
  }

  /**
   * SINGLE DIAGRAMS
   */

  public addSingleDiagram(diagramToAdd: IDiagram): void {
    if (diagramToAdd.uri.includes('temp-diagrams')) {
      return;
    }

    const indexOfDiagram: number = this._persistedSingleDiagrams.indexOf(diagramToAdd);
    const diagramIsPersisted: boolean = indexOfDiagram >= 0;

    if (diagramIsPersisted) {
      this._persistedSingleDiagrams[indexOfDiagram] = diagramToAdd;
    } else {
      this._persistedSingleDiagrams.push(diagramToAdd);
    }

    this._persistSingleDiagramsInLocalStorage();
  }

  public removeSingleDiagramByUri(diagramUri: string): void {
    const indexOfDiagramToRemove: number = this._persistedSingleDiagrams.findIndex((diagram: IDiagram) => {
      return diagram.uri === diagramUri;
    });

    this._persistedSingleDiagrams.splice(indexOfDiagramToRemove, 1);
    this._persistSingleDiagramsInLocalStorage();
  }

  public getSingleDiagrams(): Array<IDiagram> {
    return this._persistedSingleDiagrams;
  }

  public persistSolutionsInLocalStorage(): void {
    /**
     * Right now the single diagram solution entry doesn't get persisted.
     */
    const entriesToPersist: Array<ISolutionEntry> = this._allSolutionEntries.filter((entry: ISolutionEntry) => {
      const entryIsNotSingleDiagramSolution: boolean = entry.uri !== 'Single Diagrams';

      return entryIsNotSingleDiagramSolution;
    });

    window.localStorage.setItem('openedSolutions', JSON.stringify(entriesToPersist));
    this._persistedEntries = entriesToPersist;
  }

  private _getSolutionFromLocalStorage(): Array<ISolutionEntry> {
    const openedSolutions: Array<ISolutionEntry> = JSON.parse(window.localStorage.getItem('openedSolutions'));

    return openedSolutions;
  }

  private _getSingleDiagramsFromLocalStorage(): Array<IDiagram> {
    const singleDiagrams: Array<IDiagram> = JSON.parse(window.localStorage.getItem('SingleDiagrams'));
    const singleDigramsPersisted: boolean = singleDiagrams !== null;

    return singleDigramsPersisted ? singleDiagrams : [];
  }

  private _persistSingleDiagramsInLocalStorage(): void {

    window.localStorage.setItem('SingleDiagrams', JSON.stringify(this._persistedSingleDiagrams));
  }
}
