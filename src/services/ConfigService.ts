import {IConfigService} from '../contracts';

/**
 * The goal of this service is to keep most configurations out of the normal
 * business code. Especially persisting them in the localstorage and getting
 * them back at launch of the application are the main tasks of this service.
 *
 * This will keep all configurations in one place and will prevent setting and
 * getting the configurations from spreading all over the applications code.
 *
 * Every setting will be implemented via a "getter" to make it easier for
 * components to get and work with the settings. And a setter to set the value
 * of the setting and automatically persist it in the localstorage.
 */
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
