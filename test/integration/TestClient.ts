/* eslint-disable no-useless-escape */
/* eslint-disable no-empty-function */
import path from 'path';

import {Application} from 'spectron';
import assert from 'assert';

import url from 'url';

const APP_BASE_URL = `file://${__dirname}/../../index.html`;

export class TestClient {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public async awaitReadyness(): Promise<void> {
    await this.app.client.waitUntilWindowLoaded();
    await this.app.browserWindow.isVisible();
  }

  public async openDirectoryAsSolution(dir: string, diagramName?: string): Promise<void> {
    const pathToSolution: string = path.join(__dirname, '..', '..', dir);
    const identity = {
      token: 'ZHVtbXlfdG9rZW4=',
    };

    await this.webdriverClient.executeAsync(
      async (solutionPath, solutionIdentity, done) => {
        // eslint-disable-next-line no-underscore-dangle
        await (window as any).__dangerousInvoke.openSolution(solutionPath, false, solutionIdentity);

        done();
      },
      pathToSolution,
      identity,
    );
  }

  // openDesignViewForCurrentDiagram?
  public async openDesignViewFromStatusbar(): Promise<void> {
    await this.ensureVisible('[data-test-status-bar-disable-xml-view-button]');
    await this.clickOn('[data-test-status-bar-disable-xml-view-button]');
    await this.ensureVisible('diagram-detail');
  }

  // openXMLViewForCurrentDiagram?
  public async openXmlViewFromStatusbar(): Promise<void> {
    await this.ensureVisible('[data-test-status-bar-xml-view-button]');
    await this.clickOn('[data-test-status-bar-xml-view-button]');
    await this.ensureVisible('bpmn-xml-view');
  }

  public async clickOnBpmnElementWithName(name): Promise<void> {
    await this.clickOn(`.djs-label=${name}`);
  }

  public async assertWindowTitleIs(name): Promise<void> {
    const windowTitle = await this.webdriverClient.getTitle();

    assert.equal(windowTitle, name);
  }

  public async assertNavbarTitleIs(name): Promise<void> {
    const navbarTitle = await this.getTextFromElement('.process-details-title');

    assert.equal(navbarTitle, name);
  }

  public async assertSelectedBpmnElementHasName(name): Promise<void> {
    const selectedElementText = await this.getValueFromElement('[data-test-pp-element-name]');

    assert.equal(selectedElementText, name);
  }

  public async rejectSelectedBpmnElementHasName(name): Promise<void> {
    const selectedElementText = await this.getValueFromElement('[data-test-pp-element-name]');

    assert.notEqual(selectedElementText, name);
  }

  public async showPropertyPanel(): Promise<void> {
    const propertyPanelIsVisible = await this.webdriverClient.isVisible('property-panel');
    if (propertyPanelIsVisible) {
      return;
    }

    await this.ensureVisible('[data-test-toggle-propertypanel]');
    await this.clickOn('[data-test-toggle-propertypanel]');
  }

  public async hidePropertyPanel(): Promise<void> {
    const propertyPanelIsVisible = await this.webdriverClient.isVisible('property-panel');
    const propertyPanelIsHidden = !propertyPanelIsVisible;
    if (propertyPanelIsHidden) {
      return;
    }

    await this.ensureVisible('[data-test-toggle-propertypanel]');
    await this.clickOn('[data-test-toggle-propertypanel]');
  }

  public async getElement(selector): Promise<any> {
    return this.webdriverClient.element(selector);
  }

  public async getElements(selector): Promise<any> {
    return this.webdriverClient.elements(selector);
  }

  public async openStartPage(): Promise<void> {
    return this.openView('');
  }

  public async openDesignViewForDiagram(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.openDesignView('detail', diagramName, diagramUri, solutionUri);
    await this.ensureVisible('diagram-detail');
  }

  public async openXmlViewForDiagram(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.openDesignView('xml', diagramName, diagramUri, solutionUri);
    await this.ensureVisible('bpmn-xml-view');
  }

  public async openDiffViewForDiagram(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.openDesignView('diff', diagramName, diagramUri, solutionUri);
    await this.ensureVisible('bpmn-diff-view');
  }

  public async getAttributeFromElement(selector, attribute): Promise<string> {
    return this.webdriverClient.getAttribute(selector, attribute);
  }

  public async getTextFromElement(selector): Promise<string> {
    return this.webdriverClient.getText(selector);
  }

  public async getValueFromElement(selector): Promise<string> {
    return this.webdriverClient.getValue(selector);
  }

  public async elementHasText(selector, text): Promise<void> {
    return this.webdriverClient.waitUntilTextExists(selector, text);
  }

  public async ensureVisible(selector: string): Promise<boolean> {
    return this.webdriverClient.waitForVisible(selector);
  }

  public async ensureNotVisible(selector: string): Promise<boolean> {
    const collection = await this.webdriverClient.elements(selector);

    return collection.value.length === 0;
  }

  public async clickOn(selector: string): Promise<any> {
    return this.webdriverClient.$(selector).leftClick();
  }

  public async pause(timeInMilliseconds: number): Promise<void> {
    await new Promise((c: any): any => setTimeout(c, timeInMilliseconds));
  }

  private get webdriverClient(): any {
    return this.app.client;
  }

  private async openView(uriPath: string): Promise<void> {
    return this.app.browserWindow.loadURL(`${APP_BASE_URL}${uriPath}`);
  }

  private async openDesignView(
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

  public get webdriverClient(): any {
    return this.app.client;
  }
}
