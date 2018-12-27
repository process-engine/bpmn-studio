import {IConfigService} from '../contracts';

export class ConfigService implements IConfigService {
  private _solutionExplorerIsVisible: boolean = true;

  constructor() {
    this._recoverSolutionExplorerVisibility();
  }

  public setSolutionExplorerVisibility(solutionExplorerIsVisible: boolean): void {
    this._solutionExplorerIsVisible = solutionExplorerIsVisible;

    window.localStorage.setItem('SolutionExplorerVisibility', JSON.stringify(solutionExplorerIsVisible));
  }

  public getSolutionExplrorerVisibility(): boolean {
    return this._solutionExplorerIsVisible;
  }

  private _recoverSolutionExplorerVisibility(): void {
    this._solutionExplorerIsVisible = JSON.parse(window.localStorage.getItem('SolutionExplorerVisibility'));

    const solutionExplorerVisibilityIsNotSet: boolean = this._solutionExplorerIsVisible ===  null;
    if (solutionExplorerVisibilityIsNotSet) {
      this.setSolutionExplorerVisibility(true);
    }
  }
}
