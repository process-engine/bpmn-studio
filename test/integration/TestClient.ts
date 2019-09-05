/* eslint-disable no-useless-escape */
/* eslint-disable no-empty-function */
import path from 'path';
import os from 'os';
import {exec} from 'child_process';

import {AppConstructorOptions, Application} from 'spectron';
import assert from 'assert';
import {IIdentity} from '@essential-projects/iam_contracts';
import {callExposedFunction} from '../../src/services/expose-functionality-module/expose-functionality-module';
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
import {GlobalMethods} from './test-classes/global-methods';

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
  public solutionExplorer: SolutionExplorer;
  public designView: Design;
  public propertyPanel: PropertyPanel;
  public diffView: DiffView;
  public liveExecutionTracker: LiveExecutionTracker;
  public navbar: Navbar;
  public startPage: StartPage;
  public statusbar: Statusbar;
  public thinkView: ThinkView;
  public xmlView: XmlView;

  public globalMehtods: GlobalMethods;
  private app: Application;

  constructor(applicationArgs: AppConstructorOptions) {
    this.app = new Application(applicationArgs);
  }

  public async startSpectronApp(): Promise<any> {
    await this.app.start();
    this.globalMehtods = new GlobalMethods(this.app);
    this.solutionExplorer = new SolutionExplorer(this.app);
    this.designView = new Design(this.app, SAVE_DIAGRAM_DIR);
    this.propertyPanel = new PropertyPanel(this.app);
    this.diffView = new DiffView(this.app);
    this.liveExecutionTracker = new LiveExecutionTracker(this.app);
    this.navbar = new Navbar(this.app);
    this.startPage = new StartPage(this.app);
    this.statusbar = new Statusbar(this.app);
    this.thinkView = new ThinkView(this.app);
    this.xmlView = new XmlView(this.app);
  }

  public async awaitReadyness(): Promise<void> {
    await this.app.client.waitUntilWindowLoaded();
    await this.app.browserWindow.isVisible();
  }

  public async startPageLoaded(): Promise<void> {
    await this.globalMehtods.ensureVisible('[data-test-start-page]');
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
