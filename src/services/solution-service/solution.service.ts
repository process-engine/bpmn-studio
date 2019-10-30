import {inject} from 'aurelia-framework';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {ISolutionEntry, ISolutionService} from '../../contracts';
import {SolutionExplorerServiceFactory} from '../solution-explorer-services/solution-explorer-service-factory';
import {solutionIsRemoteSolution} from '../solution-is-remote-solution-module/solution-is-remote-solution.module';

@inject('SolutionExplorerServiceFactory')
export class SolutionService implements ISolutionService {
  private allSolutionEntries: Array<ISolutionEntry> = [];
  private serviceFactory: SolutionExplorerServiceFactory;
  private persistedEntries: Array<ISolutionEntry> = [];
  private persistedOpenDiagrams: Array<IDiagram> = [];

  constructor(serviceFactory: SolutionExplorerServiceFactory) {
    this.serviceFactory = serviceFactory;

    const openedSolutions: Array<ISolutionEntry> = this.getSolutionFromLocalStorage();
    this.persistedOpenDiagrams = this.getOpenDiagramsFromLocalStorage();

    const openedSolutionsAreNotSet: boolean = openedSolutions === null;
    if (openedSolutionsAreNotSet) {
      return;
    }

    openedSolutions.forEach(async (solution: ISolutionEntry) => {
      const solutionIsRemote: boolean = solutionIsRemoteSolution(solution.uri);

      solution.service = solutionIsRemote
        ? await this.serviceFactory.newManagementApiSolutionExplorer()
        : await this.serviceFactory.newFileSystemSolutionExplorer();
    });

    this.persistedEntries = openedSolutions;
    this.allSolutionEntries = this.allSolutionEntries.concat(openedSolutions);
  }

  /**
   * SOLUTIONS
   */

  public addSolutionEntry(solutionEntry: ISolutionEntry): void {
    const solutionWithSameUri: ISolutionEntry = this.allSolutionEntries.find((entry: ISolutionEntry) => {
      const entryHasSameUri: boolean = entry.uri === solutionEntry.uri;

      return entryHasSameUri;
    });
    const solutionIsAlreadyOpenend: boolean = solutionWithSameUri !== undefined;
    if (solutionIsAlreadyOpenend) {
      this.removeSolutionEntryByUri(solutionWithSameUri.uri);
    }

    this.allSolutionEntries.push(solutionEntry);
    this.persistSolutionsInLocalStorage();
  }

  public getPersistedEntries(): Array<ISolutionEntry> {
    return this.persistedEntries;
  }

  public getSolutionEntryForUri(uri: string): ISolutionEntry {
    const solutionEntry: ISolutionEntry = this.allSolutionEntries.find((entry: ISolutionEntry) => {
      const entryUriIsSearchedUri: boolean = entry.uri === uri;

      return entryUriIsSearchedUri;
    });

    return solutionEntry;
  }

  public getRemoteSolutionEntries(): Array<ISolutionEntry> {
    const remoteEntries: Array<ISolutionEntry> = this.allSolutionEntries.filter((entry: ISolutionEntry) => {
      return solutionIsRemoteSolution(entry.uri);
    });

    return remoteEntries;
  }

  public getAllSolutionEntries(): Array<ISolutionEntry> {
    return this.allSolutionEntries;
  }

  public removeSolutionEntryByUri(uri: string): void {
    const solutionToRemove: ISolutionEntry = this.allSolutionEntries.find((entry: ISolutionEntry) => {
      return entry.uri === uri;
    });

    const solutionNotFound: boolean = solutionToRemove === undefined;
    if (solutionNotFound) {
      return;
    }

    this.allSolutionEntries.splice(this.allSolutionEntries.indexOf(solutionToRemove), 1);
    this.persistSolutionsInLocalStorage();
  }

  /**
   * OPEN DIAGRAMS
   */

  public addOpenDiagram(diagramToAdd: IDiagram): void {
    const indexOfDiagram: number = this.persistedOpenDiagrams.findIndex(
      (diagram: IDiagram) => diagram.uri === diagramToAdd.uri,
    );
    const diagramIsPersisted: boolean = indexOfDiagram >= 0;

    if (diagramIsPersisted) {
      this.persistedOpenDiagrams[indexOfDiagram] = diagramToAdd;
    } else {
      this.persistedOpenDiagrams.push(diagramToAdd);
    }

    this.persistOpenDiagramsInLocalStorage();
  }

  public removeOpenDiagramByUri(diagramUri: string): void {
    const indexOfDiagramToRemove: number = this.persistedOpenDiagrams.findIndex((diagram: IDiagram) => {
      return diagram.uri === diagramUri;
    });

    this.persistedOpenDiagrams.splice(indexOfDiagramToRemove, 1);
    this.persistOpenDiagramsInLocalStorage();
  }

  public getOpenDiagrams(): Array<IDiagram> {
    return this.persistedOpenDiagrams;
  }

  public persistSolutionsInLocalStorage(): void {
    /**
     * Right now the open diagram solution entry doesn't get persisted.
     */
    const entriesToPersist: Array<ISolutionEntry> = this.allSolutionEntries.filter((entry: ISolutionEntry) => {
      const entryIsNotOpenDiagramSolution: boolean = entry.uri !== 'about:open-diagrams';

      return entryIsNotOpenDiagramSolution;
    });

    const openDiagramSolution: ISolutionEntry = this.allSolutionEntries.find((entry: ISolutionEntry) => {
      return entry.uri === 'about:open-diagrams';
    });

    if (openDiagramSolution) {
      window.localStorage.setItem('openDiagramSolutionCollapseState', JSON.stringify(openDiagramSolution.hidden));
    }
    window.localStorage.setItem('openedSolutions', JSON.stringify(entriesToPersist));
    this.persistedEntries = entriesToPersist;
  }

  private getSolutionFromLocalStorage(): Array<ISolutionEntry> {
    const openedSolutions: Array<ISolutionEntry> = JSON.parse(window.localStorage.getItem('openedSolutions'));

    return openedSolutions;
  }

  private getOpenDiagramsFromLocalStorage(): Array<IDiagram> {
    const openDiagrams: Array<IDiagram> = JSON.parse(window.localStorage.getItem('OpenDiagrams'));
    const openDiagramsWerePersisted: boolean = openDiagrams !== null;

    return openDiagramsWerePersisted ? openDiagrams : [];
  }

  private persistOpenDiagramsInLocalStorage(): void {
    window.localStorage.setItem('OpenDiagrams', JSON.stringify(this.persistedOpenDiagrams));
  }
}
