import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import * as fs from 'fs';
import path from 'path';

import {IIdentity} from '@essential-projects/iam_contracts';

import {IAuthenticationService} from '../../contracts/authentication/IAuthenticationService';
import {AuthenticationStateEvent, ISolutionEntry, ISolutionService} from '../../contracts/index';
import {HttpFetchClient} from '../fetch-http-client/http-fetch-client';
import {
  isRunningAsDevelop,
  isRunningInElectron,
} from '../../services/is-running-in-electron-module/is-running-in-electron.module';

@inject(Router, 'SolutionService', 'AuthenticationService', EventAggregator, 'HttpFetchClient')
export class ConfigPanel {
  public internalSolution: ISolutionEntry;
  public authority: string;
  public showRestartModal: boolean;

  private router: Router;
  private solutionService: ISolutionService;
  private authenticationService: IAuthenticationService;
  private eventAggregator: EventAggregator;
  private httpFetchClient: HttpFetchClient;
  private ipcRenderer: any;

  constructor(
    router: Router,
    solutionService: ISolutionService,
    authenticationService: IAuthenticationService,
    eventAggregator: EventAggregator,
    httpFetchClient: HttpFetchClient,
  ) {
    this.router = router;
    this.solutionService = solutionService;
    this.authenticationService = authenticationService;
    this.eventAggregator = eventAggregator;
    this.httpFetchClient = httpFetchClient;

    if (isRunningInElectron()) {
      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
    }
  }

  public async attached(): Promise<void> {
    const internalSolutionUri: string = window.localStorage.getItem('InternalProcessEngineRoute');

    this.internalSolution = this.solutionService.getSolutionEntryForUri(internalSolutionUri);

    let authority = this.internalSolution.authority;
    if (!authority) {
      const config = await this.getIamServiceConfig();
      authority = config.iam.baseUrl;
    }

    this.authority = authority;
  }

  public async updateSettings(): Promise<void> {
    const authorityDoesNotEndWithSlash: boolean = !this.authority.endsWith('/');
    if (authorityDoesNotEndWithSlash) {
      this.authority = `${this.authority}/`;
    }

    const userIsLoggedIn: boolean = await this.authenticationService.isLoggedIn(
      this.internalSolution.authority,
      this.internalSolution.identity,
    );

    if (userIsLoggedIn) {
      await this.authenticationService.logout(
        this.internalSolution.authority,
        this.internalSolution.uri,
        this.internalSolution.identity,
      );

      this.internalSolution.identity = this.createDummyIdentity();
      this.internalSolution.isLoggedIn = false;
      this.internalSolution.userName = undefined;

      this.internalSolution.service.openSolution(this.internalSolution.uri, this.internalSolution.identity);
      this.solutionService.persistSolutionsInLocalStorage();

      this.eventAggregator.publish(AuthenticationStateEvent.LOGOUT);
    }

    if (isRunningInElectron()) {
      const iamServiceConfig = await this.getIamServiceConfig();

      const authorityChanged: boolean = iamServiceConfig.basePath !== this.authority;
      if (authorityChanged) {
        await this.saveNewAuthority();

        this.showRestartModal = true;
      } else {
        this.router.navigateBack();
      }
    } else {
      this.internalSolution.authority = this.authority;

      this.router.navigateBack();
    }
  }

  public cancelUpdate(): void {
    this.router.navigateBack();
  }

  public async restartNow(): Promise<void> {
    this.showRestartModal = false;

    this.ipcRenderer.send('restart');
  }

  public async restartLater(): Promise<void> {
    this.showRestartModal = false;

    this.router.navigateBack();
  }

  private async saveNewAuthority(): Promise<void> {
    const iamServiceConfig = await this.getIamServiceConfig();

    iamServiceConfig.iam.baseUrl = this.authority;
    iamServiceConfig.iam.claimUrl = `${this.authority}claims/ensure`;

    const configPath: string = await this.getIamServiceConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(iamServiceConfig, null, 2));
  }

  private async getIamServiceConfig(): Promise<any> {
    const configPath: string = await this.getIamServiceConfigPath();
    const iamServiceConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    return iamServiceConfig;
  }

  private async getIamServiceConfigPath(): Promise<string> {
    const pathToJson: string = 'configs/sqlite.json';

    let iamServiceConfigPath: string;

    const isDevelop: boolean = await isRunningAsDevelop();
    if (!isDevelop) {
      iamServiceConfigPath = path.join(__dirname, '..', '..', pathToJson);
    } else {
      iamServiceConfigPath = path.join(__dirname, pathToJson);
    }

    return iamServiceConfigPath;
  }

  public get uriIsValid(): boolean {
    if (this.uriIsEmpty) {
      return true;
    }

    /**
     * This RegEx checks if the entered URI is valid or not.
     */
    const urlRegEx: RegExp = /^(?:http(s)?:\/\/)+[\w.-]?[\w\-._~:/?#[\]@!$&'()*+,;=.]+$/g;
    const uriIsValid: boolean = urlRegEx.test(this.authority);

    return uriIsValid;
  }

  public get uriIsEmpty(): boolean {
    const uriIsEmtpy: boolean = this.authority === undefined || this.authority.length === 0;

    return uriIsEmtpy;
  }

  private createDummyIdentity(): IIdentity {
    const accessToken: string = this.createDummyAccessToken();
    // TODO: Get the identity from the IdentityService of `@process-engine/iam`
    const identity: IIdentity = {
      token: accessToken,
      userId: '', // Provided by the IdentityService.
    };

    return identity;
  }

  private createDummyAccessToken(): string {
    const dummyAccessTokenString: string = 'dummy_token';
    const base64EncodedString: string = btoa(dummyAccessTokenString);

    return base64EncodedString;
  }
}
