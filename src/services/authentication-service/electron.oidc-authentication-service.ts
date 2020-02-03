import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import Bluebird from 'bluebird';
import queryString from 'querystring';
import nodeUrl from 'url';

import {IIdentity} from '@essential-projects/iam_contracts';
import {IResponse} from '@essential-projects/http_contracts';

import {
  AuthenticationStateEvent,
  IAuthenticationService,
  ILoginResult,
  ITokenObject,
  IUserIdentity,
  NotificationType,
} from '../../contracts/index';

import {NotificationService} from '../notification-service/notification.service';
import oidcConfig from '../../open-id-connect-electron-configuration';
import {HttpFetchClient} from '../../modules/fetch-http-client/http-fetch-client';

const UNAUTHORIZED_STATUS_CODE: number = 401;
const IDENTITY_SERVER_AVAILABLE_SUCCESS_STATUS_CODE: number = 200;

const identityServerCookieName = '.AspNetCore.Identity.Application';
const cookieUrl = 'http://localhost';

@inject(EventAggregator, 'NotificationService', 'HttpFetchClient')
export class ElectronOidcAuthenticationService implements IAuthenticationService {
  private eventAggregator: EventAggregator;
  private notificationService: NotificationService;
  private electronRemote: Electron.Remote;
  private httpFetchClient: HttpFetchClient;

  private solutionsToRefresh: Array<string> = [];
  private refreshTimeouts: Map<string, any> = new Map();

  constructor(
    eventAggregator: EventAggregator,
    notificationService: NotificationService,
    httpFetchClient: HttpFetchClient,
  ) {
    this.eventAggregator = eventAggregator;
    this.notificationService = notificationService;
    this.httpFetchClient = httpFetchClient;

    this.electronRemote = (window as any).nodeRequire('electron').remote;
  }

  public async isLoggedIn(authorityUrl: string, identity: IIdentity): Promise<boolean> {
    authorityUrl = this.formAuthority(authorityUrl);

    let userIdentity: IUserIdentity;

    try {
      userIdentity = await this.getUserIdentity(authorityUrl, identity);
    } catch (error) {
      return false;
    }

    const userIdentityIsDefined: boolean = userIdentity !== undefined && userIdentity !== null;

    return userIdentityIsDefined;
  }

  public async login(
    authorityUrl: string,
    solutionUri: string,
    refreshCallback: Function,
    silent?: boolean,
  ): Promise<ILoginResult> {
    authorityUrl = this.formAuthority(authorityUrl);

    const identityServerIsNotReachable: boolean = !(await this.isAuthorityReachable(authorityUrl));
    if (identityServerIsNotReachable) {
      return undefined;
    }

    const tokenObject: ITokenObject = await this.showLoginPopup(authorityUrl, solutionUri, silent);

    const silentRefreshHandler = async (silentRefreshTokenObject: ITokenObject): Promise<void> => {
      const loginResult = await this.convertTokenObjectToLoginResult(authorityUrl, silentRefreshTokenObject);

      refreshCallback(loginResult);
    };
    this.startSilentRefreshing(authorityUrl, solutionUri, tokenObject, silentRefreshHandler);

    const loginResult = this.convertTokenObjectToLoginResult(authorityUrl, tokenObject);

    this.eventAggregator.publish(AuthenticationStateEvent.LOGIN);

    return loginResult;
  }

  public async logout(authorityUrl: string, solutionUri: string, identity: IIdentity, silent?: boolean): Promise<void> {
    authorityUrl = this.formAuthority(authorityUrl);

    await this.showLogoutPopup(authorityUrl, solutionUri, identity, silent);
    this.eventAggregator.publish(AuthenticationStateEvent.LOGOUT);
  }

  public async getUserIdentity(authorityUrl: string, identity: IIdentity): Promise<IUserIdentity | null> {
    authorityUrl = this.formAuthority(authorityUrl);

    const userInfoResponse: IResponse<any> = await this.httpFetchClient.get(`${authorityUrl}connect/userinfo`, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${identity.token}`,
      },
    });
    const requestIsUnauthorized: boolean = userInfoResponse.result.status === UNAUTHORIZED_STATUS_CODE;

    if (requestIsUnauthorized) {
      return null;
    }

    return userInfoResponse.result;
  }

  private async showLogoutPopup(
    authorityUrl: string,
    solutionUri: string,
    identity: IIdentity,
    silent?: boolean,
  ): Promise<boolean> {
    const urlParams = {
      id_token_hint: identity.userId,
      post_logout_redirect_uri: oidcConfig.logoutRedirectUri,
    };

    const endSessionUrl = `${authorityUrl}connect/endsession?${queryString.stringify(urlParams)}`;

    this.stopSilentRefreshing(solutionUri);
    this.removeIdentityServerCookieOfSolution(solutionUri);

    return new Promise(
      async (resolve: Function): Promise<void> => {
        const response = await fetch(endSessionUrl);

        const windowParams = {
          show: silent !== true,
          alwaysOnTop: true,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
          },
        };

        const logoutWindow = new this.electronRemote.BrowserWindow(windowParams || {useContentSize: true});

        logoutWindow.webContents.on('will-navigate', (event, url) => {
          if (url.includes(oidcConfig.logoutRedirectUri)) {
            event.preventDefault();
            resolve(true);
            logoutWindow.close();
          }
        });

        logoutWindow.on('closed', () => {
          resolve(true);
        });

        logoutWindow.loadURL(response.url);
        if (!silent) {
          logoutWindow.show();
        } else {
          logoutWindow.webContents.on('did-finish-load', () => {
            resolve(true);
            logoutWindow.close();
          });
        }
      },
    );
  }

  private async convertTokenObjectToLoginResult(
    authorityUrl: string,
    tokenObject: ITokenObject,
  ): Promise<ILoginResult> {
    const iamIdentity: IIdentity = {
      token: tokenObject.accessToken,
      userId: tokenObject.idToken,
    };
    const identity: IUserIdentity = await this.getUserIdentity(authorityUrl, iamIdentity);

    const loginResult: ILoginResult = {
      identity: identity,
      accessToken: tokenObject.accessToken,
      idToken: tokenObject.idToken,
    };
    return loginResult;
  }

  private async showLoginPopup(authorityUrl: string, solutionUri: string, silent?: boolean): Promise<ITokenObject> {
    if (!(await this.identityServerCookieIsEmpty())) {
      await this.waitUntilCookieIsEmpty();
    }

    if (await this.solutionHasIdentityServerCookie(solutionUri)) {
      await this.setIdentityServerCookie(solutionUri);
    }

    // Build the Url Params from the Config.
    const urlParams = {
      client_id: oidcConfig.clientId,
      redirect_uri: oidcConfig.redirectUri,
      response_type: oidcConfig.responseType,
      scope: oidcConfig.scope,
      state: this.getRandomString(16),
      nonce: this.getRandomString(16),
    };

    const urlToLoad: string = `${authorityUrl}connect/authorize?${queryString.stringify(urlParams)}`;

    const windowParams = {
      show: silent !== true,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
      },
    };

    return new Promise((resolve: Function, reject: Function): void => {
      // Open a new browser window and load the previously constructed url.
      const authWindow = new this.electronRemote.BrowserWindow(windowParams);

      authWindow.loadURL(urlToLoad);
      if (!silent) {
        authWindow.show();
      }

      // Reject the Promise when the user closes the new window.
      authWindow.on(
        'closed',
        async (): Promise<void> => {
          await this.removeCurrentIdentityServerCookie();

          reject(new Error('window was closed by user'));
        },
      );

      /**
       * This will trigger everytime the new window will redirect.
       * Important: Not AFTER it redirects but BEFORE.
       * This gives us the possibility to intercept the redirect to
       * the specified redirect uri, which would lead to faulty behaviour
       * due to security aspects in chromium.
       *
       * If that redirect would start we stop it by preventing the default
       * behaviour and instead parse its parameters in the
       * "onCallback"-function.
       */
      authWindow.webContents.on('will-redirect', (event: Electron.Event, url: string): void => {
        if (url.includes(oidcConfig.redirectUri)) {
          event.preventDefault();
        }

        const redirectCallbackResolved = async (tokenObject: ITokenObject): Promise<void> => {
          await this.setCurrentIdentityServerCookieForSolution(solutionUri);
          await this.removeCurrentIdentityServerCookie();

          resolve(tokenObject);
        };

        this.handleRedirectCallback(url, authWindow, redirectCallbackResolved, reject);
      });
    });
  }

  private startSilentRefreshing(
    authorityUrl: string,
    solutionUri: string,
    tokenObject: ITokenObject,
    refreshCallback: Function,
  ): void {
    this.solutionsToRefresh.push(solutionUri);

    this.silentRefresh(authorityUrl, solutionUri, tokenObject, refreshCallback);
  }

  private stopSilentRefreshing(solutionUri: string): void {
    if (this.refreshTimeouts.has(solutionUri)) {
      this.refreshTimeouts.get(solutionUri).cancel();
      this.refreshTimeouts.delete(solutionUri);
    }
    if (this.solutionsToRefresh.includes(solutionUri)) {
      const solutionToReemove = this.solutionsToRefresh.findIndex((solution) => solution === solutionUri);
      this.solutionsToRefresh.splice(solutionToReemove, 1);
    }
  }

  private async silentRefresh(
    authorityUrl: string,
    solutionUri: string,
    tokenObject: ITokenObject,
    refreshCallback: Function,
  ): Promise<void> {
    // Token refresh factor is set as described at https://github.com/manfredsteyer/angular-oauth2-oidc/blob/master/docs-src/silent-refresh.md#automatically-refreshing-a-token-when-before-it-expires-code-flow-and-implicit-flow
    const tokenRefreshFactor = 0.75;
    const secondsInMilisecondsFactor = 1000;
    const tokenRefreshInterval = tokenObject.expiresIn * tokenRefreshFactor * secondsInMilisecondsFactor;

    const timeout = this.wait(tokenRefreshInterval);
    this.refreshTimeouts.set(solutionUri, timeout);
    await timeout;

    if (!this.solutionsToRefresh.includes(solutionUri)) {
      return;
    }

    if (await this.solutionHasIdentityServerCookie(solutionUri)) {
      await this.setIdentityServerCookie(solutionUri);
    }

    // Build the Url Params from the Config.
    const urlParams = {
      client_id: oidcConfig.clientId,
      redirect_uri: oidcConfig.redirectUri,
      response_type: oidcConfig.responseType,
      scope: oidcConfig.scope,
      state: this.getRandomString(16),
      nonce: this.getRandomString(16),
      prompt: 'none',
    };

    const urlToLoad: string = `${authorityUrl}connect/authorize?${queryString.stringify(urlParams)}`;

    // Open a new browser window and load the previously constructed url.
    const authWindow = new this.electronRemote.BrowserWindow({show: false});

    authWindow.loadURL(urlToLoad);

    // Throw an error, if the user closes the new window.
    authWindow.on('closed', (): void => {
      throw new Error('window was closed by user');
    });

    /**
     * This will trigger everytime the new window will redirect.
     * Important: Not AFTER it redirects but BEFORE.
     * This gives us the possibility to intercept the redirect to
     * the specified redirect uri, which would lead to faulty behaviour
     * due to security aspects in chromium.
     *
     * If that redirect would start we stop it by preventing the default
     * behaviour and instead parse its parameters in the
     * "onCallback"-function.
     */
    authWindow.webContents.on('will-redirect', (event: Electron.Event, url: string): void => {
      if (url.includes(oidcConfig.redirectUri)) {
        event.preventDefault();
      }

      const redirectCallbackResolved = async (token: ITokenObject): Promise<void> => {
        refreshCallback(token);
        await this.setCurrentIdentityServerCookieForSolution(solutionUri);
        await this.removeCurrentIdentityServerCookie();

        this.silentRefresh(authorityUrl, solutionUri, token, refreshCallback);
      };

      const redirectCallbackRejected = (error: Error): void => {
        if (error.message !== 'User is no longer logged in.') {
          throw error;
        }

        this.stopSilentRefreshing(solutionUri);
      };

      this.handleRedirectCallback(url, authWindow, redirectCallbackResolved, redirectCallbackRejected);
    });
  }

  // Handle the different callbacks.
  private handleRedirectCallback(
    url: string,
    authWindow: Electron.BrowserWindow,
    resolve: Function,
    reject: Function,
  ): void {
    // Parse callback url into its parts.
    const urlParts = nodeUrl.parse(url, true);
    const href = urlParts.href;

    /**
     * If there was an error:
     * - Reject the promise with the error.
     * - Close the window.
     *
     * If the href includes the callback uri:
     * - Load that href in the window.
     *
     * If the href includes the specified redirect uri:
     * - Parse the hash into its parts.
     * - Add those parts to new object.
     * - Resolve the promise with this object.
     * - Close the window.
     */
    if (href === null) {
      reject(new Error(`Could not parse url: ${url}`));

      authWindow.removeAllListeners('closed');

      setImmediate(() => {
        authWindow.close();
      });
    } else if (href.includes('/connect/authorize/callback')) {
      authWindow.loadURL(href);
    } else if (href.includes(oidcConfig.redirectUri)) {
      const identityParameter = urlParts.hash;
      const parameterAsArray = identityParameter.split('&');

      if (parameterAsArray[0].includes('login_required')) {
        reject(new Error('User is no longer logged in.'));

        return;
      }

      const idToken = parameterAsArray[0].split('=')[1];
      const accessToken = parameterAsArray[1].split('=')[1];

      const expiresIn: number = parseInt(
        parameterAsArray.find((parameter) => parameter.startsWith('expires_in=')).split('=')[1],
      );

      const tokenObject: ITokenObject = {
        idToken,
        accessToken,
        expiresIn,
      };

      resolve(tokenObject);
      authWindow.removeAllListeners('closed');

      setImmediate(() => {
        authWindow.close();
      });
    }
  }

  private async isAuthorityReachable(authorityUrl: string): Promise<boolean> {
    const configRequest: Request = new Request(`${authorityUrl}.well-known/openid-configuration`, {
      method: 'GET',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });

    let configResponse: Response;

    try {
      configResponse = await fetch(configRequest);
    } catch (error) {
      const identityServerWasOffline: boolean = error.message === 'Failed to fetch';
      if (identityServerWasOffline) {
        this.notificationService.showNotification(NotificationType.ERROR, 'IdentityServer is offline.');

        return false;
      }
    }

    const identityServerWasAvailable: boolean = configResponse.status === IDENTITY_SERVER_AVAILABLE_SUCCESS_STATUS_CODE;
    if (identityServerWasAvailable) {
      return true;
    }

    return false;
  }

  private formAuthority(authorityUrl: string): string {
    if (authorityUrl === undefined) {
      return undefined;
    }

    const authorityDoesNotEndWithSlash: boolean = !authorityUrl.endsWith('/');

    if (authorityDoesNotEndWithSlash) {
      authorityUrl = `${authorityUrl}/`;
    }

    return authorityUrl;
  }

  private async getIdentityServerCookie(): Promise<Electron.Cookie> {
    const cookies = await this.electronRemote.session.defaultSession.cookies.get({});

    return cookies.find((cookie) => {
      return cookie.name === identityServerCookieName;
    });
  }

  private async getIdentityServerCookieForSolution(solutionUri: string): Promise<Electron.Cookie> {
    const persistedCookie = localStorage.getItem(this.getCookieNameForSolution(solutionUri));

    return persistedCookie ? JSON.parse(persistedCookie) : undefined;
  }

  private async setIdentityServerCookie(solutionUri: string): Promise<void> {
    const cookieToSet = await this.getIdentityServerCookieForSolution(solutionUri);

    const cookiesSetDetails: Electron.CookiesSetDetails = Object.assign(cookieToSet, {url: cookieUrl});
    cookiesSetDetails.name = identityServerCookieName;

    this.electronRemote.session.defaultSession.cookies.set(cookiesSetDetails);
  }

  private async setCurrentIdentityServerCookieForSolution(solutionUri: string): Promise<void> {
    const currentIdentityServerCookie = await this.getIdentityServerCookie();

    localStorage.setItem(this.getCookieNameForSolution(solutionUri), JSON.stringify(currentIdentityServerCookie));
  }

  private removeCurrentIdentityServerCookie(): Promise<void> {
    return this.electronRemote.session.defaultSession.cookies.remove(cookieUrl, identityServerCookieName);
  }

  private removeIdentityServerCookieOfSolution(solutionUri: string): void {
    localStorage.removeItem(this.getCookieNameForSolution(solutionUri));
  }

  private async identityServerCookieIsEmpty(): Promise<boolean> {
    return (await this.getIdentityServerCookie()) === undefined;
  }

  private async solutionHasIdentityServerCookie(solutionUri: string): Promise<boolean> {
    return localStorage.getItem(this.getCookieNameForSolution(solutionUri)) !== null;
  }

  private async waitUntilCookieIsEmpty(): Promise<void> {
    while (!(await this.identityServerCookieIsEmpty())) {
      await this.wait(100);
    }
  }

  private getCookieNameForSolution(solutionUri: string): string {
    return `identity-server-cookie__${solutionUri}`;
  }

  private wait(ms: number): Promise<void> {
    return new Bluebird.Promise((resolve: Function) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }

  private getRandomString(length: number): string {
    const charset: string = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._~';
    let randomString: string = '';

    for (let i: number = 0; i < length; i++) {
      randomString += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return randomString;
  }
}
