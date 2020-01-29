import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';

import {
  AuthenticationStateEvent,
  IAuthenticationService,
  ILoginResult,
  IUserIdentity,
  NotificationType,
} from '../../contracts/index';

import {NotificationService} from '../notification-service/notification.service';

const UNAUTHORIZED_STATUS_CODE: number = 401;
const IDENTITY_SERVER_AVAILABLE_SUCCESS_STATUS_CODE: number = 200;

@inject(EventAggregator, 'NotificationService')
export class ElectronOidcAuthenticationService implements IAuthenticationService {
  private eventAggregator: EventAggregator;
  private notificationService: NotificationService;

  constructor(eventAggregator: EventAggregator, notificationService: NotificationService) {
    this.eventAggregator = eventAggregator;
    this.notificationService = notificationService;
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

  public async login(authorityUrl: string, solutionUri: string, refreshCallback: Function): Promise<ILoginResult> {
    authorityUrl = this.formAuthority(authorityUrl);

    const identityServerIsNotReachable: boolean = !(await this.isAuthorityReachable(authorityUrl));
    if (identityServerIsNotReachable) {
      return undefined;
    }

    const loginResultPromise: Promise<ILoginResult> = new Promise(
      async (resolve: Function): Promise<void> => {
        const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;

        ipcRenderer.on(`oidc-silent_refresh-${solutionUri}`, async (event, tokenObject) => {
          const iamIdentity: IIdentity = {
            token: tokenObject.accessToken,
            userId: tokenObject.idToken,
          };
          const identity: IUserIdentity = await this.getUserIdentity(authorityUrl, iamIdentity);

          const silentRefreshResult: ILoginResult = {
            identity: identity,
            accessToken: tokenObject.accessToken,
            idToken: tokenObject.idToken,
          };

          refreshCallback(silentRefreshResult);
        });

        ipcRenderer.on('oidc-login-reply', async (event, tokenObject) => {
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

          ipcRenderer.removeAllListeners('oidc-login-reply');

          resolve(loginResult);
        });

        ipcRenderer.send('oidc-login', {authorityUrl, solutionUri});
      },
    );

    return loginResultPromise;
  }

  public async logout(authorityUrl: string, solutionUri: string, identity: IIdentity): Promise<void> {
    authorityUrl = this.formAuthority(authorityUrl);

    const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;

    ipcRenderer.on('oidc-logout-reply', async (event: any, logoutWasSuccessful: boolean) => {
      if (logoutWasSuccessful) {
        this.eventAggregator.publish(AuthenticationStateEvent.LOGOUT);
      }

      ipcRenderer.removeAllListeners(`oidc-silent_refresh-${solutionUri}`);
    });

    ipcRenderer.send('oidc-logout', identity, {authorityUrl, solutionUri});
  }

  public async getUserIdentity(authorityUrl: string, identity: IIdentity): Promise<IUserIdentity | null> {
    authorityUrl = this.formAuthority(authorityUrl);

    const userInfoRequest: Request = new Request(`${authorityUrl}connect/userinfo`, {
      method: 'GET',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${identity.token}`,
      },
    });

    const userInfoResponse: Response = await fetch(userInfoRequest);
    const requestIsUnauthorized: boolean = userInfoResponse.status === UNAUTHORIZED_STATUS_CODE;

    if (requestIsUnauthorized) {
      return null;
    }

    return userInfoResponse.json();
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
}
