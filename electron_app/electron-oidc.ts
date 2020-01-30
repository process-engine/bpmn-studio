import queryString from 'querystring';
import fetch from 'node-fetch';
import nodeUrl from 'url';
import {BrowserWindowConstructorOptions, Event as ElectronEvent, session} from 'electron';
import crypto from 'crypto';
import Bluebird from 'bluebird';
import Store from 'electron-store';

import {IOidcConfig, ITokenObject} from '../src/contracts/index';

// eslint-disable-next-line @typescript-eslint/no-require-imports
import electron = require('electron');

const BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow;
const solutionsToRefresh: Array<string> = [];
const refreshTimeouts: Map<string, any> = new Map();

const identityServerCookieName = '.AspNetCore.Identity.Application';
const cookieUrl = 'http://localhost';
const solutionCookieStore = new Store();

export default (
  config: IOidcConfig,
  windowParams: BrowserWindowConstructorOptions,
): {
  getTokenObject: (authorityUrl: string, solutionUri: string) => Promise<ITokenObject>;
  logout: (authorityUrl: string, solutionUri: string, tokenObject: ITokenObject) => Promise<boolean>;
  startSilentRefreshing: (
    authorityUrl: string,
    solutionUri: string,
    tokenObject: ITokenObject,
    refreshCallback: Function,
  ) => void;
} => {
  function getTokenObjectForSolution(authorityUrl, solutionUri): Promise<any> {
    return getTokenObject(authorityUrl, solutionUri, config, windowParams);
  }

  function logoutForSolution(authorityUrl: string, solutionUri: string, tokenObject: ITokenObject): Promise<boolean> {
    return logout(authorityUrl, solutionUri, tokenObject, config, windowParams);
  }

  function refreshTokenViaSilentRefresh(
    authorityUrl: string,
    solutionUri: string,
    tokenObject: ITokenObject,
    refreshCallback: Function,
  ): void {
    return startSilentRefreshing(authorityUrl, solutionUri, config, tokenObject, refreshCallback);
  }

  return {
    getTokenObject: getTokenObjectForSolution,
    logout: logoutForSolution,
    startSilentRefreshing: refreshTokenViaSilentRefresh,
  };
};

async function getTokenObject(
  authorityUrl: string,
  solutionUri: string,
  config: IOidcConfig,
  windowParams: BrowserWindowConstructorOptions,
): Promise<{
  idToken: string;
  accessToken: string;
}> {
  if (!(await identityServerCookieIsEmpty())) {
    await waitUntilCookieIsEmpty();
  }

  if (await solutionHasIdentityServerCookie(solutionUri)) {
    await setIdentityServerCookie(solutionUri);
  }

  // Build the Url Params from the Config.
  const urlParams = {
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: config.responseType,
    scope: config.scope,
    state: getRandomString(16),
    nonce: getRandomString(16),
  };

  const urlToLoad: string = `${authorityUrl}connect/authorize?${queryString.stringify(urlParams)}`;

  return new Promise((resolve: Function, reject: Function): void => {
    // Open a new browser window and load the previously constructed url.
    const authWindow = new BrowserWindow(windowParams || {useContentSize: true});

    authWindow.loadURL(urlToLoad);
    authWindow.show();

    // Reject the Promise when the user closes the new window.
    authWindow.on('closed', (): void => {
      reject(new Error('window was closed by user'));
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
    authWindow.webContents.on('will-redirect', (event: ElectronEvent, url: string): void => {
      if (url.includes(config.redirectUri)) {
        event.preventDefault();
      }

      const redirectCallbackResolved = async (tokenObject: ITokenObject): Promise<void> => {
        await setCurrentIdentityServerCookieForSolution(solutionUri);
        await removeCurrentIdentityServerCookie();

        resolve(tokenObject);
      };

      redirectCallback(url, authWindow, config, redirectCallbackResolved, reject);
    });
  });
}

// Handle the different callbacks.
function redirectCallback(
  url: string,
  authWindow: electron.BrowserWindow,
  config: IOidcConfig,
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
  } else if (href.includes(config.redirectUri)) {
    const identityParameter = urlParts.hash;
    const parameterAsArray = identityParameter.split('&');

    if (parameterAsArray[0].includes('login_required')) {
      reject(new Error('User is no longer logged in.'));

      return;
    }

    const idToken = parameterAsArray[0].split('=')[1];
    const accessToken = parameterAsArray[1].split('=')[1];

    const expiresIn = parameterAsArray.find((parameter) => parameter.startsWith('expires_in=')).split('=')[1];

    const tokenObject = {
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

function logout(
  authorityUrl: string,
  solutionUri: string,
  tokenObject: ITokenObject,
  config: IOidcConfig,
  windowParams: BrowserWindowConstructorOptions,
): Promise<boolean> {
  const urlParams = {
    id_token_hint: tokenObject.userId,
    post_logout_redirect_uri: config.logoutRedirectUri,
  };

  const endSessionUrl = `${authorityUrl}connect/endsession?${queryString.stringify(urlParams)}`;

  stopSilentRefreshing(solutionUri);

  removeIdentityServerCookieOfSolution(solutionUri);

  return new Promise(
    async (resolve: Function): Promise<void> => {
      const response: fetch.Response = await fetch(endSessionUrl);

      const logoutWindow = new BrowserWindow(windowParams || {useContentSize: true});

      logoutWindow.webContents.on('will-navigate', (event, url) => {
        if (url.includes(config.logoutRedirectUri)) {
          event.preventDefault();
          resolve(true);
          logoutWindow.close();
        }
      });

      logoutWindow.on('closed', () => {
        resolve(true);
      });

      logoutWindow.loadURL(response.url);
      logoutWindow.show();
    },
  );
}

async function silentRefresh(
  authorityUrl: string,
  solutionUri: string,
  config: IOidcConfig,
  tokenObject: ITokenObject,
  refreshCallback: Function,
): Promise<void> {
  // Token refresh factor is set as described at https://github.com/manfredsteyer/angular-oauth2-oidc/blob/master/docs-src/silent-refresh.md#automatically-refreshing-a-token-when-before-it-expires-code-flow-and-implicit-flow
  const tokenRefreshFactor = 0.75;
  const secondsInMilisecondsFactor = 1000;
  const tokenRefreshInterval = tokenObject.expiresIn * tokenRefreshFactor * secondsInMilisecondsFactor;

  const timeout = wait(tokenRefreshInterval);
  refreshTimeouts.set(solutionUri, timeout);
  await timeout;

  if (!solutionsToRefresh.includes(solutionUri)) {
    return;
  }

  if (await solutionHasIdentityServerCookie(solutionUri)) {
    await setIdentityServerCookie(solutionUri);
  }

  // Build the Url Params from the Config.
  const urlParams = {
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: config.responseType,
    scope: config.scope,
    state: getRandomString(16),
    nonce: getRandomString(16),
    prompt: 'none',
  };

  const urlToLoad: string = `${authorityUrl}connect/authorize?${queryString.stringify(urlParams)}`;

  // Open a new browser window and load the previously constructed url.
  const authWindow = new BrowserWindow({show: false});

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
  authWindow.webContents.on('will-redirect', (event: ElectronEvent, url: string): void => {
    if (url.includes(config.redirectUri)) {
      event.preventDefault();
    }

    const redirectCallbackResolved = async (token: ITokenObject): Promise<void> => {
      refreshCallback(token);
      await setCurrentIdentityServerCookieForSolution(solutionUri);
      await removeCurrentIdentityServerCookie();

      silentRefresh(authorityUrl, solutionUri, config, token, refreshCallback);
    };

    const redirectCallbackRejected = (error: Error): void => {
      if (error.message !== 'User is no longer logged in.') {
        throw error;
      }

      stopSilentRefreshing(solutionUri);
    };

    redirectCallback(url, authWindow, config, redirectCallbackResolved, redirectCallbackRejected);
  });
}

function startSilentRefreshing(
  authorityUrl: string,
  solutionUri: string,
  config: IOidcConfig,
  tokenObject: ITokenObject,
  refreshCallback: Function,
): void {
  solutionsToRefresh.push(solutionUri);

  silentRefresh(authorityUrl, solutionUri, config, tokenObject, refreshCallback);
}

function stopSilentRefreshing(solutionUri: string): void {
  if (refreshTimeouts.has(solutionUri)) {
    refreshTimeouts.get(solutionUri).cancel();
    refreshTimeouts.delete(solutionUri);
  }
  if (solutionsToRefresh.includes(solutionUri)) {
    const solutionToReemove = solutionsToRefresh.findIndex((solution) => solution === solutionUri);
    solutionsToRefresh.splice(solutionToReemove, 1);
  }
}

function wait(ms: number): Promise<void> {
  return new Bluebird.Promise((resolve: Function) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function getRandomString(length: number): string {
  const charset: string = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._~';
  let result: string = '';

  while (length > 0) {
    const randomValues: Buffer = crypto.randomBytes(length);

    // eslint-disable-next-line no-loop-func
    randomValues.forEach((value: number) => {
      if (length === 0) {
        return;
      }

      if (value < charset.length) {
        result += charset[value];
        length--;
      }
    });
  }

  return result;
}

async function getIdentityServerCookie(): Promise<electron.Cookie> {
  const cookies = await session.defaultSession.cookies.get({});

  return cookies.find((cookie) => {
    return cookie.name === identityServerCookieName;
  });
}

async function getIdentityServerCookieForSolution(solutionUri: string): Promise<electron.Cookie> {
  const persistedCookie = solutionCookieStore.get(getCookieNameForSolution(solutionUri));

  return persistedCookie ? JSON.parse(persistedCookie) : undefined;
}

async function setIdentityServerCookie(solutionUri: string): Promise<void> {
  const cookieToSet = await getIdentityServerCookieForSolution(solutionUri);

  const cookiesSetDetails: electron.CookiesSetDetails = Object.assign(cookieToSet, {url: cookieUrl});
  cookiesSetDetails.name = identityServerCookieName;

  session.defaultSession.cookies.set(cookiesSetDetails);
}

async function setCurrentIdentityServerCookieForSolution(solutionUri: string): Promise<void> {
  const currentIdentityServerCookie = await getIdentityServerCookie();

  solutionCookieStore.set(getCookieNameForSolution(solutionUri), JSON.stringify(currentIdentityServerCookie));
}

function removeCurrentIdentityServerCookie(): Promise<void> {
  return session.defaultSession.cookies.remove(cookieUrl, identityServerCookieName);
}

function removeIdentityServerCookieOfSolution(solutionUri: string): void {
  solutionCookieStore.delete(getCookieNameForSolution(solutionUri));
}

async function identityServerCookieIsEmpty(): Promise<boolean> {
  return (await getIdentityServerCookie()) === undefined;
}

async function solutionHasIdentityServerCookie(solutionUri: string): Promise<boolean> {
  return solutionCookieStore.has(getCookieNameForSolution(solutionUri));
}

async function waitUntilCookieIsEmpty(): Promise<void> {
  while (!(await identityServerCookieIsEmpty())) {
    await wait(100);
  }
}

function getCookieNameForSolution(solutionUri: string): string {
  return `identity-server-cookie__${solutionUri}`;
}
