import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import * as fs from 'fs';
import path from 'path';

import {IIdentity} from '@essential-projects/iam_contracts';

import {IAuthenticationService} from '../../contracts/authentication/IAuthenticationService';
import {AuthenticationStateEvent, ISolutionEntry, ISolutionService} from '../../contracts/index';

import {
  isRunningAsDevelop,
  isRunningInElectron,
} from '../../services/is-running-in-electron-module/is-running-in-electron.module';

@inject(Router, 'SolutionService', 'AuthenticationService', EventAggregator)
export class ConfigPanel {
  public internalSolution: ISolutionEntry;
  public authority: string;
  public showRestartModal: boolean;
  public allowUnauthorizedCertificates: boolean;
  public certificatesFileInputRef: HTMLInputElement;
  public additionalCertificates: Array<string> = [];

  private router: Router;
  private solutionService: ISolutionService;
  private authenticationService: IAuthenticationService;
  private eventAggregator: EventAggregator;
  private ipcRenderer: any;

  constructor(
    router: Router,
    solutionService: ISolutionService,
    authenticationService: IAuthenticationService,
    eventAggregator: EventAggregator,
  ) {
    this.router = router;
    this.solutionService = solutionService;
    this.authenticationService = authenticationService;
    this.eventAggregator = eventAggregator;

    if (isRunningInElectron()) {
      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
    }
  }

  public async attached(): Promise<void> {
    const config = await this.getInternalProcessEngineConfig();
    this.allowUnauthorizedCertificates = config.httpClient.allowUnauthorizedCertificates;
    const configuredCertificates = config.tls?.trustedCertificates;
    if (configuredCertificates != null && Array.isArray(configuredCertificates)) {
      this.additionalCertificates = configuredCertificates;
    } else if (configuredCertificates != null && typeof configuredCertificates === 'string' && configuredCertificates.trim() !== '') {
      this.additionalCertificates.push(configuredCertificates);
    }

    const internalSolutionUri: string = window.localStorage.getItem('InternalProcessEngineRoute');

    this.internalSolution = this.solutionService.getSolutionEntryForUri(internalSolutionUri);

    let authority = this.internalSolution.authority;
    if (!authority) {
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
      const config = await this.getInternalProcessEngineConfig();

      const authorityChanged = config.basePath !== this.authority;
      const allowUnauthorizedCertificatesChanged = config.httpClient.allowUnauthorizedCertificates !== this.allowUnauthorizedCertificates;
      const additionalCertificatesChanged = JSON.stringify(config) !== JSON.stringify(this.additionalCertificates);
      if (authorityChanged || allowUnauthorizedCertificatesChanged || additionalCertificatesChanged) {
        await this.saveNewAuthority();
        await this.saveAllowUnauthorizedCertificates();
        await this.saveAdditionalCertificates();

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

  private removeCert(certificatePath: string): void {
    const indexOfCertificate = this.additionalCertificates.indexOf(certificatePath);
    this.additionalCertificates.splice(indexOfCertificate, 1);
  }

  private certificatesFileInputChanged(): void {
    Array.from(this.certificatesFileInputRef.files).forEach((file) => {
      const certDoesNotExistInList = !this.additionalCertificates.includes(file.path);
      if (certDoesNotExistInList) {
        this.additionalCertificates.push(file.path);
      }
    });
  }

  private async saveAdditionalCertificates(): Promise<void> {
    const config = await this.getInternalProcessEngineConfig();

    if (config.tls == null) {
      config.tls = {};
    }

    if (this.additionalCertificates.length <= 1) {
      config.tls.trustedCertificates = this.additionalCertificates[0] ?? '';
    } else {
      config.tls.trustedCertificates = this.additionalCertificates;
    }

    const configPath: string = await this.getInternalProcessEngineConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  private async saveAllowUnauthorizedCertificates(): Promise<void> {
    const config = await this.getInternalProcessEngineConfig();

    config.httpClient.allowUnauthorizedCertificates = this.allowUnauthorizedCertificates;

    const configPath: string = await this.getInternalProcessEngineConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  private async saveNewAuthority(): Promise<void> {
    const config = await this.getInternalProcessEngineConfig();

    config.iam.baseUrl = this.authority;
    config.iam.claimUrl = `${this.authority}claims/ensure`;

    const configPath: string = await this.getInternalProcessEngineConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  private async getInternalProcessEngineConfig(): Promise<any> {
    const configPath: string = await this.getInternalProcessEngineConfigPath();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    return config;
  }

  private async getInternalProcessEngineConfigPath(): Promise<string> {
    const pathToJson: string = 'configs/sqlite.json';

    let internalProcessEngineConfigPath: string;

    const isDevelop: boolean = await isRunningAsDevelop();
    if (!isDevelop) {
      internalProcessEngineConfigPath = path.join(__dirname, '..', '..', pathToJson);
    } else {
      internalProcessEngineConfigPath = path.join(__dirname, pathToJson);
    }

    return internalProcessEngineConfigPath;
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
