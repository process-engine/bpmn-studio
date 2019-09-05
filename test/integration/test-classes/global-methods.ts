import {IIdentity} from '@essential-projects/iam_contracts';
import {Application} from 'spectron';

import assert from 'assert';

const APP_BASE_URL = `file://${__dirname}/../../../index.html`;

export class GlobalMethods {
  protected webdriverClient: any;
  protected app: Application;

  constructor(app: Application) {
    this.app = app;
    this.webdriverClient = this.app.client;
  }

  public async elementHasText(selector, text): Promise<void> {
    return this.webdriverClient.waitUntilTextExists(selector, text);
  }

  public async ensureVisible(selector: string, timeout?: number): Promise<boolean> {
    return this.webdriverClient.waitForVisible(selector, timeout);
  }

  public async assertWindowTitleIs(name): Promise<void> {
    const windowTitle = await this.webdriverClient.getTitle();

    assert.equal(windowTitle, name);
  }

  public async pause(timeInMilliseconds: number): Promise<void> {
    await new Promise((c: Function): any => setTimeout(c, timeInMilliseconds));
  }

  protected async getElement(selector): Promise<any> {
    return this.webdriverClient.element(selector);
  }

  protected async getElements(selector): Promise<any> {
    return this.webdriverClient.elements(selector);
  }

  protected async getAttributeFromElement(selector, attribute): Promise<string> {
    return this.webdriverClient.getAttribute(selector, attribute);
  }

  protected async getTextFromElement(selector): Promise<string> {
    return this.webdriverClient.getText(selector);
  }

  protected async getValueFromElement(selector): Promise<string> {
    return this.webdriverClient.getValue(selector);
  }

  protected async ensureNotVisible(selector: string): Promise<boolean> {
    const collection = await this.webdriverClient.elements(selector);

    return collection.value.length === 0;
  }

  protected async clickOn(selector: string): Promise<any> {
    return this.webdriverClient.$(selector).leftClick();
  }

  protected getDefaultIdentity(): IIdentity {
    const identity = {
      token: 'ZHVtbXlfdG9rZW4=',
      userId: '',
    };

    return identity;
  }

  protected async openDesignView(
    subPath: string,
    diagramName: string,
    diagramUri: string,
    solutionUri?: string,
  ): Promise<void> {
    const encodedName = encodeURIComponent(diagramName);
    const encodedUri = encodeURIComponent(diagramUri);
    const encodedSolutionUri = solutionUri ? encodeURIComponent(solutionUri) : '';
    const uriFragment = `#/design/${subPath}/diagram/${encodedName}?diagramUri=${encodedUri}&solutionUri=${encodedSolutionUri}`;

    return this.openView(uriFragment);
  }

  protected async openView(uriPath: string): Promise<void> {
    return this.app.browserWindow.loadURL(`${APP_BASE_URL}${uriPath}`);
  }
}
