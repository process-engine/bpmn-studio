import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {OpenIdConnect} from 'aurelia-open-id-connect';
import {Router} from 'aurelia-router';
import {User} from 'oidc-client';

import {IIdentity} from '@essential-projects/iam_contracts';

import {
  AuthenticationStateEvent,
  IAuthenticationService,
  ILoginResult,
  IUserIdentity,
  NotificationType,
} from '../../contracts/index';
import {oidcConfig} from '../../open-id-connect-configuration';
import {NotificationService} from '../notification-service/notification.service';

const UNAUTHORIZED_STATUS_CODE: number = 401;
const IDENTITY_SERVER_AVAILABLE_SUCCESS_STATUS_CODE: number = 200;

@inject(EventAggregator, 'NotificationService', OpenIdConnect, Router)
export class WebOidcAuthenticationService implements IAuthenticationService {
  private eventAggregator: EventAggregator;
  /**
   * We have to use any here since it is the only way to access the private members
   * of this. We need the access them when changing the authority while the application
   * is running.
   */
  private openIdConnect: OpenIdConnect | any;
  private notificationService: NotificationService;

  constructor(
    eventAggregator: EventAggregator,
    notificationService: NotificationService,
    openIdConnect: OpenIdConnect,
  ) {
    this.eventAggregator = eventAggregator;
    this.notificationService = notificationService;
    this.openIdConnect = openIdConnect;
  }

  public async isLoggedIn(authority: string, identity: IIdentity): Promise<boolean> {
    authority = this.formAuthority(authority);

    const userIdentity: IUserIdentity = await this.getUserIdentity(authority);

    const userIsAuthorized: boolean = userIdentity !== null && userIdentity !== undefined;

    return userIsAuthorized;
  }

  public async login(authority: string): Promise<ILoginResult> {
    authority = this.formAuthority(authority);

    const isAuthorityUnReachable: boolean = !(await this.isAuthorityReachable(authority));

    if (isAuthorityUnReachable) {
      this.notificationService.showNotification(NotificationType.ERROR, 'Authority seems to be offline');

      return undefined;
    }

    await this.setAuthority(authority);

    const signinResult: User = await this.openIdConnect.userManager.signinPopup();

    window.localStorage.setItem('openIdRoute', authority);

    const iamIdentity: IIdentity = {
      token: signinResult.access_token,
      userId: signinResult.id_token,
    };
    const identity: IUserIdentity = await this.getUserIdentity(authority, iamIdentity);

    const loginResult: ILoginResult = {
      identity: identity,
      accessToken: iamIdentity.token,
      idToken: iamIdentity.userId,
    };

    return loginResult;
  }

  public async logout(authority: string, identity: IIdentity): Promise<void> {
    authority = this.formAuthority(authority);

    if (!this.isLoggedIn) {
      return;
    }

    await this.setAuthority(authority);
    await this.openIdConnect.logout();
  }

  public async getUserIdentity(authority: string, identity?: IIdentity): Promise<IUserIdentity | null> {
    authority = this.formAuthority(authority);

    const accessToken: string = identity === undefined ? await this.getAccessToken(authority) : identity.token;
    const accessTokenIsDummyToken: boolean = accessToken === this.getDummyAccessToken();

    if (accessTokenIsDummyToken) {
      return null;
    }

    const request: Request = new Request(`${authority}connect/userinfo`, {
      method: 'GET',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const response: Response = await fetch(request);

    if (response.status === UNAUTHORIZED_STATUS_CODE) {
      return null;
    }

    return response.json();
  }

  private async isAuthorityReachable(authority: string): Promise<boolean> {
    const request: Request = new Request(`${authority}.well-known/openid-configuration`, {
      method: 'GET',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });

    let response: Response;

    try {
      response = await fetch(request);
    } catch (error) {
      if (error.message === 'Failed to fetch') {
        return false;
      }
    }

    if (response.status === IDENTITY_SERVER_AVAILABLE_SUCCESS_STATUS_CODE) {
      return true;
    }

    return false;
  }

  private setAuthority(authority: string): void {
    oidcConfig.userManagerSettings.authority = authority;

    // This dirty way to update the settings is the only way during runtime
    this.openIdConnect.configuration.userManagerSettings.authority = authority;
    // eslint-disable-next-line no-underscore-dangle
    this.openIdConnect.userManager._settings._authority = authority;
  }

  // TODO: The dummy token needs to be removed in the future!!
  // This dummy token serves as a temporary workaround to bypass login. This
  // enables us to work without depending on a full environment with
  // IdentityServer.
  private getDummyAccessToken(): string {
    const dummyAccessTokenString: string = 'dummy_token';
    const base64EncodedString: string = btoa(dummyAccessTokenString);

    return base64EncodedString;
  }

  private async getAccessToken(authority: string): Promise<string | null> {
    this.setAuthority(authority);
    const user: User = await this.openIdConnect.getUser();

    const userIsNotLoggedIn: boolean = user === undefined || user === null;

    return userIsNotLoggedIn ? this.getDummyAccessToken() : user.access_token;
  }

  private formAuthority(authority: string): string {
    const authorityDoesNotEndWithSlash: boolean = !authority.endsWith('/');

    if (authorityDoesNotEndWithSlash) {
      authority = `${authority}/`;
    }

    return authority;
  }
}
