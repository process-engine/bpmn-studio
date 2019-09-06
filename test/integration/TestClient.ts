/* eslint-disable no-useless-escape */
/* eslint-disable no-empty-function */
import path from 'path';
import os from 'os';
import {exec} from 'child_process';

import {AppConstructorOptions, Application} from 'spectron';
import assert from 'assert';
import {IIdentity} from '@essential-projects/iam_contracts';

import {SolutionExplorer} from './test-classes/solution-explorer';
import {PropertyPanel} from './test-classes/property-panel';
import {Design} from './test-classes/design-view';
import {DiffView} from './test-classes/diff-view';
import {LiveExecutionTracker} from './test-classes/live-execution-tracker';
import {Navbar} from './test-classes/navbar';
import {StartPage} from './test-classes/startpage';
import {Statusbar} from './test-classes/status-bar';
import {ThinkView} from './test-classes/think-view';
import {XmlView} from './test-classes/xml-view';

function getUserConfigFolder(): string {
  const userHomeDir = os.homedir();
  switch (process.platform) {
    case 'darwin':
      return path.join(userHomeDir, 'Library', 'Application Support');
    case 'win32':
      return path.join(userHomeDir, 'AppData', 'Roaming');
    default:
      return path.join(userHomeDir, '.config');
  }
}

const APP_BASE_URL = `file://${__dirname}/../../../../index.html`;
const DATABASE_PATH = path.join(getUserConfigFolder(), 'bpmn-studio-tests', 'process_engine_databases');
const SAVE_DIAGRAM_DIR = path.join(getUserConfigFolder(), 'bpmn-studio-tests', 'saved_diagrams');

export class TestClient {
  public solutionExplorer: SolutionExplorer = new SolutionExplorer(this);
  public designView: Design = new Design(this, SAVE_DIAGRAM_DIR);
  public propertyPanel: PropertyPanel = new PropertyPanel(this);
  public diffView: DiffView = new DiffView(this);
  public liveExecutionTracker: LiveExecutionTracker = new LiveExecutionTracker(this);
  public navbar: Navbar = new Navbar(this);
  public startPage: StartPage = new StartPage(this);
  public statusbar: Statusbar = new Statusbar(this);
  public thinkView: ThinkView = new ThinkView(this);
  public xmlView: XmlView = new XmlView(this);

  private app: Application;

  constructor(applicationArgs: AppConstructorOptions) {
    this.app = new Application(applicationArgs);
  }

  public async startSpectronApp(): Promise<any> {
    await this.app.start();
  }

  public async awaitReadyness(): Promise<void> {
    await this.app.client.waitUntilWindowLoaded();
    await this.app.browserWindow.isVisible();
  }

  public async startPageLoaded(): Promise<void> {
    await this.ensureVisible('[data-test-start-page]');
  }

  public async ensureVisible(selector: string, timeout?: number): Promise<boolean> {
    return this.webdriverClient.waitForVisible(selector, timeout);
  }

  public async clearDatabase(): Promise<void> {
    await this.execCommand(`rm -rf ${DATABASE_PATH.replace(/\s/g, '\\ ')}`);
  }

  public async clearSavedDiagrams(): Promise<void> {
    await this.execCommand(`rm -rf ${SAVE_DIAGRAM_DIR.replace(/\s/g, '\\ ')}`);
  }

  public async isSpectronAppRunning(): Promise<boolean> {
    return this.app.isRunning();
  }

  public async stopSpectronApp(): Promise<Application> {
    return this.app.stop();
  }

  public get webdriverClient(): any {
    return this.app.client;
  }

  public async clickOn(selector: string): Promise<any> {
    return this.webdriverClient.$(selector).leftClick();
  }

  public async openDesignView(
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

  public async elementHasText(selector, text): Promise<void> {
    return this.webdriverClient.waitUntilTextExists(selector, text);
  }

  public async assertWindowTitleIs(name): Promise<void> {
    const windowTitle = await this.webdriverClient.getTitle();

    assert.equal(windowTitle, name);
  }

  public async pause(timeInMilliseconds: number): Promise<void> {
    await new Promise((c: Function): any => setTimeout(c, timeInMilliseconds));
  }

  public async getElement(selector): Promise<any> {
    return this.webdriverClient.element(selector);
  }

  public async getElements(selector): Promise<any> {
    return this.webdriverClient.elements(selector);
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

  public async ensureNotVisible(selector: string): Promise<boolean> {
    const collection = await this.webdriverClient.elements(selector);

    return collection.value.length === 0;
  }

  public getDefaultIdentity(): IIdentity {
    const identity = {
      token: 'ZHVtbXlfdG9rZW4=',
      userId: '',
    };

    return identity;
  }

  public async openView(uriPath: string): Promise<void> {
    return this.app.browserWindow.loadURL(`${APP_BASE_URL}${uriPath}`);
  }

  private async execCommand(command: string): Promise<any> {
    return new Promise((resolve: Function, reject: Function): any => {
      exec(command, (err, stdin, stderr) => {
        if (err || stderr) {
          reject(err, stderr);
        }
        return resolve(stdin);
      });
    });
  }
}
