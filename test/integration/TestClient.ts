/* eslint-disable no-useless-escape */
/* eslint-disable no-empty-function */
import path from 'path';
import fs from 'fs';
import {exec} from 'child_process';

import {Application} from 'spectron';
import assert from 'assert';

import url from 'url';

const APP_BASE_URL = `file://${__dirname}/../../index.html`;
const DATABASE_PATH = path.join(__dirname, '..', '..', 'dist', 'test', 'process_engine_databases');
const SAVE_DIAGRAM_DIR = path.join(__dirname, '..', '..', 'dist', 'test', 'saved_diagrams');

export class TestClient {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public async awaitReadyness(): Promise<void> {
    await this.app.client.waitUntilWindowLoaded();
    await this.app.browserWindow.isVisible();
  }

  public async showSolutionExplorer(): Promise<void> {
    const solutionExplorerIsVisible = await this.webdriverClient.isVisible('solution-explorer-panel');
    if (solutionExplorerIsVisible) {
      return;
    }

    await this.ensureVisible('[data-test-toggle-solution-explorer]');
    await this.clickOn('[data-test-toggle-solution-explorer]');
    await this.ensureVisible('solution-explorer-panel');
  }

  public async hideSolutionExplorer(): Promise<void> {
    const solutionExplorerIsVisible = await this.webdriverClient.isVisible('solution-explorer-panel');
    const solutionExplorerIsHidden = !solutionExplorerIsVisible;
    if (solutionExplorerIsHidden) {
      return;
    }

    await this.ensureVisible('[data-test-toggle-solution-explorer]');
    await this.clickOn('[data-test-toggle-solution-explorer]');
    await this.ensureNotVisible('solution-explorer-panel');
    // solution-explorer-panel
  }

  public async assertInternalProcessEngineHasStarted(): Promise<void> {
    const response = await this.webdriverClient.execute(() => {
      return window.localStorage.getItem('InternalProcessEngineRoute');
    });

    const internalProcessEngineRoute = response.value;

    await this.ensureVisible(`.solution-entry__solution-name=${internalProcessEngineRoute}`);
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

    await this.ensureVisible(`.solution-entry__solution-name=${dir}`);

    if (diagramName) {
      const isWindows = process.platform === 'win32';

      const searchString = isWindows ? `${pathToSolution}\\${diagramName}` : `${pathToSolution}/${diagramName}`;
      await this.clickOn(`[data-test-diagram-uri*="${searchString}"]`);
    }
  }

  public async startProcess(): Promise<void> {
    await this.clickOn('[data-test-diagram-start-button]');
    await this.ensureVisible('.live-execution-tracker');
  }

  public async stopProcess(): Promise<void> {
    await this.clickOn('[data-test-stop-process-button]');
    await this.ensureNotVisible('[data-test-stop-process-button]');
  }

  public async deployDiagram(): Promise<void> {
    await this.clickOn('[data-test-diagram-deploy-button]');
  }

  public async clearDatabase(): Promise<void> {
    await this.execCommand('rm -rf dist/test/process_engine_databases');
  }

  public async clearSavedDiagrams(): Promise<void> {
    await this.execCommand('rm -rf dist/test/saved_diagrams');
  }

  public async assertDiagramIsOnFileSystem(): Promise<void> {
    await this.ensureVisible('[data-test-navbar-icon]');
    const classAttribute = await this.getAttributeFromElement('[data-test-navbar-icon]', 'class');
    const isOnFileSystem: boolean = classAttribute.includes('fa-folder');

    assert.equal(isOnFileSystem, true);
  }

  public async assertDiagramIsOnProcessEngine(): Promise<void> {
    await this.ensureVisible('[data-test-navbar-icon]');
    const classAttribute = await this.getAttributeFromElement('[data-test-navbar-icon]', 'class');
    const isOnProcessEngine: boolean = classAttribute.includes('fa-database');

    assert.equal(isOnProcessEngine, true);
    Promise.resolve();
  }

  public async saveDiagramAs(fileName: string): Promise<void> {
    const fileUri: string = path.join(SAVE_DIAGRAM_DIR, fileName);
    const directoryExists: boolean = await fs.existsSync(SAVE_DIAGRAM_DIR);

    if (!directoryExists) {
      fs.mkdirSync(SAVE_DIAGRAM_DIR);
    }

    await this.webdriverClient.executeAsync(async (pathToSave, done) => {
      // eslint-disable-next-line no-underscore-dangle
      await (window as any).__dangerousInvoke.saveDiagramAs(pathToSave);

      done();
    }, fileUri);
  }

  public async assertDiagramIsSaved(): Promise<void> {
    await this.ensureNotVisible('.edited-label');
  }

  public async assertDiagramIsUnsaved(): Promise<void> {
    await this.ensureVisible('.edited-label');
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
    await this.ensureVisible('.process-details-title');
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

  public async openThinkView(diagramName?: string, diagramUri?: string, solutionUri?: string): Promise<void> {
    if (diagramName && diagramUri) {
      const encodedName = encodeURIComponent(diagramName);
      const encodedUri = encodeURIComponent(diagramUri);
      const encodedSolutionUri = solutionUri ? encodeURIComponent(solutionUri) : '';
      const uriFragment = `#/think/diagram-list/diagram/${encodedName}?diagramUri=${encodedUri}&solutionUri=${encodedSolutionUri}`;

      await this.openView(uriFragment);
    } else {
      await this.openView('#/think/diagram-list/diagram');
    }

    await this.ensureVisible('diagram-list');
  }

  public async openThinkViewFromNavbar(): Promise<void> {
    await this.clickOn('[data-test-navbar="Think"]');
    await this.ensureVisible('diagram-list');
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

  public async ensureVisible(selector: string, timeout?: number): Promise<boolean> {
    return this.webdriverClient.waitForVisible(selector, timeout);
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

  private async execCommand(command: string): Promise<any> {
    return new Promise((resolve: Function): any => {
      exec(command, (err, stdin, stderr) => {
        return resolve(stdin);
      });
    });
  }
}
