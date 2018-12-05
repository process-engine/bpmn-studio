import {ISolutionEntry, ISolutionService} from '../contracts';

export class SolutionService implements ISolutionService {
  private _allSolutionEntries: Array<ISolutionEntry> = [];
  private _activeSolution: ISolutionEntry;

  public addSolutionEntry(solutionEntry: ISolutionEntry): void {
    this._allSolutionEntries.push(solutionEntry);
  }

  public closeSolutionEntry(solutionEntry: ISolutionEntry): void {
    this._allSolutionEntries.splice(this._allSolutionEntries.indexOf(solutionEntry));
  }

  public getActiveSolutionEntry(): ISolutionEntry {
    const test: string = window.localStorage.getItem('ActiveSolutionEntry');

    if (this._activeSolution === undefined) {
      if (test === undefined) {
        return undefined;
      } else {
        return JSON.parse(test);
      }
    } else {
      return this._activeSolution;
    }
    // return this._activeSolution;
  }

  public getSolutionEntryForUri(uri: string): ISolutionEntry {
    const solutionEntry: ISolutionEntry = this._allSolutionEntries.find((entry: ISolutionEntry) => {
      return entry.uri === uri;
    });

    return solutionEntry;
  }

  public setActiveSolution(solution: ISolutionEntry): void {
    this._activeSolution = solution;
    window.localStorage.setItem('ActiveSolutionEntry', JSON.stringify(this._activeSolution));
  }

  public getActiveDiagram(): IDiagram {
    const test: string = window.localStorage.getItem('ActiveDiagram');

    if (this._activeDiagram === undefined) {
      if (test === undefined) {
        return undefined;
      } else {
        return JSON.parse(test);
      }
    } else {
      return this._activeDiagram;
    }
    // return this._activeDiagram ? this._activeDiagram : JSON.parse();
  }

  public setActiveDiagram(diagram: IDiagram): void {
    this._activeDiagram = diagram;

    window.localStorage.setItem('ActiveDiagram', JSON.stringify(this._activeDiagram));
    this._eventAggregator.publish(environment.events.navBar.updateActiveSolutionAndDiagram);
  }
}
