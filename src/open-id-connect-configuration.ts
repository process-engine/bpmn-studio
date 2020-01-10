import {OpenIdConnectConfiguration} from 'aurelia-open-id-connect';
import {WebStorageStateStore} from 'oidc-client';
import environment from './environment';

export const oidcConfig: OpenIdConnectConfiguration = {
  loginRedirectRoute: '/',
  logoutRedirectRoute: '/',
  unauthorizedRedirectRoute: '/',
  logLevel: 0,
  userManagerSettings: {
    accessTokenExpiringNotificationTime: 1,
    authority: environment.openIdConnect.authority,
    automaticSilentRenew: true,
    monitorSession: true,
    checkSessionInterval: 2000,
    client_id: 'bpmn_studio',
    filterProtocolClaims: true,
    loadUserInfo: false,
    post_logout_redirect_uri: `${environment.appHost}/signout-oidc`,
    popup_redirect_uri: `${environment.appHost}/signin-popup-redirect`,
    redirect_uri: `${environment.appHost}/signin-oidc`,
    response_type: 'id_token token',
    scope: 'openid profile test_resource',
    silentRequestTimeout: 10000,
    silent_redirect_uri: `${environment.appHost}/signin-oidc`,
    userStore: new WebStorageStateStore({
      prefix: 'oidc',
      store: window.localStorage,
    }),
  },
};
