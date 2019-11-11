import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {IIdentity} from '@essential-projects/iam_contracts';

import {
  AuthenticationStateEvent,
  IAuthenticationService,
  ILoginResult,
  ITokenObject,
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

  public async isLoggedIn(authority: string, identity: IIdentity): Promise<boolean> {
    authority = this.formAuthority(authority);

    let userIdentity: IUserIdentity;

    try {
      userIdentity = await this.getUserIdentity(authority, identity);
    } catch (error) {
      return false;
    }

    const userIdentityIsDefined: boolean = userIdentity !== undefined && userIdentity !== null;

    return userIdentityIsDefined;
  }

  public async login(authority: string): Promise<ILoginResult> {
    authority = this.formAuthority(authority);

    const identityServerIsNotReachable: boolean = !(await this.isAuthorityReachable(authority));

    if (identityServerIsNotReachable) {
      return undefined;
    }

    const loginResultPromise: Promise<ILoginResult> = new Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;

        ipcRenderer.on('oidc-login-reply', async (event: any, tokenObject: ITokenObject) => {
          const iamIdentity: IIdentity = {
            token: tokenObject.accessToken,
            userId: tokenObject.idToken,
          };
          const identity: IUserIdentity = await this.getUserIdentity(authority, iamIdentity);

          const loginResult: ILoginResult = {
            identity: identity,
            accessToken: tokenObject.accessToken,
            idToken: tokenObject.idToken,
          };

          ipcRenderer.removeAllListeners('oidc-login-reply');

          resolve(loginResult);
        });

        ipcRenderer.send('oidc-login', authority);
      },
    );

    return loginResultPromise;
  }

  public async logout(authority: string, identity: IIdentity): Promise<void> {
    authority = this.formAuthority(authority);

    const ipcRenderer: any = (window as any).nodeRequire('electron').ipcRenderer;

    ipcRenderer.on('oidc-logout-reply', async (event: any, logoutWasSuccessful: boolean) => {
      if (logoutWasSuccessful) {
        this.eventAggregator.publish(AuthenticationStateEvent.LOGOUT);
      }
    });

    ipcRenderer.send('oidc-logout', identity, authority);
  }

  public async getUserIdentity(authority: string, identity: IIdentity): Promise<IUserIdentity | null> {
    authority = this.formAuthority(authority);

    const userInfoRequest: Request = new Request(`${authority}connect/userinfo`, {
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

  private async isAuthorityReachable(authority: string): Promise<boolean> {
    const configRequest: Request = new Request(`${authority}.well-known/openid-configuration`, {
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

  private formAuthority(authority: string): string {
    const authorityDoesNotEndWithSlash: boolean = !authority.endsWith('/');

    if (authorityDoesNotEndWithSlash) {
      authority = `${authority}/`;
    }

    return authority;
  }
}
