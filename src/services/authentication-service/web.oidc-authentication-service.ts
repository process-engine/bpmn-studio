import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {OpenIdConnect} from 'aurelia-open-id-connect';
import {Router} from 'aurelia-router';
import {User} from 'oidc-client';

import {IIdentity} from '@essential-projects/iam_contracts';

import {IAuthenticationService, ILoginResult, IUserIdentity, NotificationType} from '../../contracts/index';
import {oidcConfig} from '../../open-id-connect-web-configuration';
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
  private openIdConnect: OpenIdConnect;
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

  public async isLoggedIn(authorityUrl: string, identity: IIdentity): Promise<boolean> {
    authorityUrl = this.formAuthority(authorityUrl);

    const userIdentity: IUserIdentity = await this.getUserIdentity(authorityUrl);

    const userIsAuthorized: boolean = userIdentity !== null && userIdentity !== undefined;

    return userIsAuthorized;
  }

  public async login(authorityUrl: string, solutionUri: string, refreshCallback: Function): Promise<ILoginResult> {
    authorityUrl = this.formAuthority(authorityUrl);

    const isAuthorityUnReachable: boolean = !(await this.isAuthorityReachable(authorityUrl));

    if (isAuthorityUnReachable) {
      this.notificationService.showNotification(NotificationType.ERROR, 'AuthorityUrl seems to be offline');

      return undefined;
    }

    await this.setAuthority(authorityUrl);

    const signinResult: User = await this.openIdConnect.userManager.signinPopup();

    window.localStorage.setItem('openIdRoute', authorityUrl);

    const iamIdentity: IIdentity = {
      token: signinResult.access_token,
      userId: signinResult.id_token,
    };
    const identity: IUserIdentity = await this.getUserIdentity(authorityUrl, iamIdentity);

    const loginResult: ILoginResult = {
      identity: identity,
      accessToken: iamIdentity.token,
      idToken: iamIdentity.userId,
    };

    this.openIdConnect.observeUser(async (user: User) => {
      const refreshedIamIdentity: IIdentity = {
        token: user.access_token,
        userId: signinResult.id_token,
      };
      const refreshedIdentity: IUserIdentity = await this.getUserIdentity(authorityUrl, refreshedIamIdentity);

      const refreshResult: ILoginResult = {
        identity: refreshedIdentity,
        accessToken: refreshedIamIdentity.token,
        idToken: refreshedIamIdentity.userId,
      };

      refreshCallback(refreshResult);
    });

    return loginResult;
  }

  public async logout(authorityUrl: string, solutionUri: string, identity: IIdentity): Promise<void> {
    authorityUrl = this.formAuthority(authorityUrl);

    if (!this.isLoggedIn) {
      return;
    }

    await this.setAuthority(authorityUrl);
    await this.openIdConnect.userManager.signoutPopup();
  }

  public async getUserIdentity(authorityUrl: string, identity?: IIdentity): Promise<IUserIdentity | null> {
    authorityUrl = this.formAuthority(authorityUrl);

    const accessToken: string = identity === undefined ? await this.getAccessToken(authorityUrl) : identity.token;
    const accessTokenIsDummyToken: boolean = accessToken === this.getDummyAccessToken();

    if (accessTokenIsDummyToken) {
      return null;
    }

    const request: Request = new Request(`${authorityUrl}connect/userinfo`, {
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

  private async isAuthorityReachable(authorityUrl: string): Promise<boolean> {
    const request: Request = new Request(`${authorityUrl}.well-known/openid-configuration`, {
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

  private setAuthority(authorityUrl: string): void {
    oidcConfig.userManagerSettings.authority = authorityUrl;

    // This dirty way to update the settings is the only way during runtime
    (this.openIdConnect as any).configuration.userManagerSettings.authorityUrl = authorityUrl;
    // eslint-disable-next-line no-underscore-dangle
    (this.openIdConnect.userManager as any)._settings._authority = authorityUrl;
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

  private async getAccessToken(authorityUrl: string): Promise<string | null> {
    this.setAuthority(authorityUrl);
    const user: User = await this.openIdConnect.getUser();

    const userIsNotLoggedIn: boolean = user === undefined || user === null;

    return userIsNotLoggedIn ? this.getDummyAccessToken() : user.access_token;
  }

  private formAuthority(authorityUrl: string): string {
    const authorityDoesNotEndWithSlash: boolean = !authorityUrl.endsWith('/');

    if (authorityDoesNotEndWithSlash) {
      authorityUrl = `${authorityUrl}/`;
    }

    return authorityUrl;
  }
}
