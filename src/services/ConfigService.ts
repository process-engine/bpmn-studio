import {IConfigService} from '../contracts';

export class ConfigService implements IConfigService {
  private _solutionExplorerIsVisible: boolean = true;

  constructor() {
    this._recoverSolutionExplorerVisibility();
  }

  public set solutionExplorerIsVisible(solutionExplorerIsVisible: boolean) {
    this._solutionExplorerIsVisible = solutionExplorerIsVisible;

    window.localStorage.setItem('SolutionExplorerVisibility', JSON.stringify(solutionExplorerIsVisible));
  }

  public get solutionExplorerIsVisible(): boolean {
    return this._solutionExplorerIsVisible;
  }

  private _recoverSolutionExplorerVisibility(): void {
    this._solutionExplorerIsVisible = JSON.parse(window.localStorage.getItem('SolutionExplorerVisibility'));

    const solutionExplorerVisibilityIsNotSet: boolean = this._solutionExplorerIsVisible === null;
    if (solutionExplorerVisibilityIsNotSet) {
      this.solutionExplorerIsVisible = true;
    }
  }
}
