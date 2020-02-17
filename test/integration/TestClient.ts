/* eslint-disable no-useless-escape */
/* eslint-disable no-empty-function */
import path from 'path';
import os from 'os';
import {exec} from 'child_process';
import fs from 'fs-extra';

import {AppConstructorOptions, Application} from 'spectron';
import assert from 'assert';
import {IIdentity} from '@essential-projects/iam_contracts';

import {SolutionExplorer} from './test-classes/solution-explorer';
import {DesignViewClient} from './test-classes/design-view';
import {callExposedFunction} from '../../src/services/expose-functionality-module/expose-functionality.module';

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
const TESTS_FOLDER_PATH = path.join(getUserConfigFolder(), 'bpmn-studio-tests');
const DATABASE_PATH = path.join(TESTS_FOLDER_PATH, 'process_engine_databases');
const SAVE_DIAGRAM_DIR = path.join(TESTS_FOLDER_PATH, 'saved_diagrams');
const VISIBLE_TIMEOUT = 40000;
const REMOVE_COMMAND_DIR = process.platform === 'win32' ? 'rmdir /s /q' : 'rm -rf';
const REMOVE_COMMAND_FILE = process.platform === 'win32' ? 'del /f' : 'rm -f';

export class TestClient {
  public solutionExplorer: SolutionExplorer = new SolutionExplorer(this);
  public designView: DesignViewClient = new DesignViewClient(this, SAVE_DIAGRAM_DIR);
  public creatingFirstDiagram: boolean = true;

  private startDate: string;
  private app: Application;

  constructor(applicationArgs: AppConstructorOptions) {
    this.app = new Application(applicationArgs);
    // eslint-disable-next-line newline-per-chained-call
    this.startDate = new Date().toISOString().replace(/:/g, '-');
  }

  public getVideoFilePathForTest(test: Mocha.Test): string {
    const testName = test.title.replace(/\s/g, '-');
    const suiteName = test.parent.title.replace(/\s/g, '-');
    return `test-results/${this.startDate}_${suiteName}_${testName}.webm`;
  }

  public async startSpectronApp(): Promise<any> {
    await this.app.start();
  }

  public async awaitReadiness(): Promise<void> {
    await this.app.client.waitUntilWindowLoaded();
    await this.app.browserWindow.isVisible();
  }

  public async startRecording(filepath: string): Promise<void> {
    await callExposedFunction(this.webdriverClient, 'startRecording', filepath);
  }

  public async cancelRecording(): Promise<void> {
    await callExposedFunction(this.webdriverClient, 'cancelRecording');
  }

  public async stopRecordingAndSave(): Promise<void> {
    await callExposedFunction(this.webdriverClient, 'stopRecordingAndSave');
  }

  public async startPageLoaded(): Promise<void> {
    await this.ensureVisible('[data-test-start-page]', VISIBLE_TIMEOUT);
  }

  public async removeUnneededVideos(filePath: string): Promise<void> {
    try {
      const filePathToUse = `${filePath.replace('.webm', '*.webm')}`;

      if (process.platform === 'win32') {
        const filesToDelete = fs.readdirSync(path.dirname(filePathToUse), {encoding: 'utf8'}).filter((file) => {
          const lastIndexOfMinus = filePath.lastIndexOf('-');
          return file.includes(path.basename(filePath.substr(0, lastIndexOfMinus)));
        });

        for (const fileToDelete of filesToDelete) {
          await this.deleteFile(`test-results\\${fileToDelete}`);
        }
      } else {
        await this.execCommand(`${REMOVE_COMMAND_FILE} ${filePathToUse.replace(/"/g, '\\"')}`);
      }
    } catch (error) {
      console.error('Error: removeUnneededVideos', error);
    }
  }

  public async clickOnBpmnElementWithName(name): Promise<void> {
    await this.ensureVisible(`.djs-label=${name}`, VISIBLE_TIMEOUT);
    await this.clickOn(`.djs-label=${name}`);
  }

  public async assertCanvasModelIsVisible(): Promise<void> {
    const canvasModelIsVisible = await this.webdriverClient.isVisible('[data-test-canvas-model]');
    assert.equal(canvasModelIsVisible, true);
  }

  public async assertDiagramIsOnFileSystem(): Promise<void> {
    await this.ensureVisible('[data-test-navbar-icon-local-solution]', VISIBLE_TIMEOUT);
  }

  public async assertDiagramIsOnProcessEngine(): Promise<void> {
    await this.ensureVisible('[data-test-navbar-icon-remote-solution]', VISIBLE_TIMEOUT);
  }

  public async assertNavbarTitleIs(name): Promise<void> {
    await this.ensureVisible('[data-test-navbar-title]', VISIBLE_TIMEOUT);
    const navbarTitle = await this.getTextFromElement('[data-test-navbar-title]');

    assert.equal(navbarTitle, name);
  }

  public async assertDiagramIsSaved(): Promise<void> {
    await this.ensureNotVisible('[data-test-edited-label]');
  }

  public async assertDiagramIsUnsaved(): Promise<void> {
    await this.ensureVisible('[data-test-edited-label]', VISIBLE_TIMEOUT);
  }

  public async ensureVisible(selector: string, timeout?: number): Promise<boolean> {
    return this.webdriverClient.waitForVisible(selector, timeout);
  }

  public async removeTestsFolder(): Promise<void> {
    await this.execCommand(`${REMOVE_COMMAND_DIR} ${TESTS_FOLDER_PATH.replace(/\s/g, '\\ ')}`);
  }

  public async clearDatabase(): Promise<void> {
    if (fs.existsSync(DATABASE_PATH)) {
      try {
        if (process.platform === 'win32') {
          await this.removeWindowsDB(DATABASE_PATH);
        } else {
          await this.execCommand(`${REMOVE_COMMAND_DIR} ${DATABASE_PATH.replace(/\s/g, '\\ ')}`);
        }
      } catch (error) {
        console.error('Error:clearDatabase ', error);
      }
    }
  }

  public async clearSavedDiagrams(): Promise<void> {
    if (fs.existsSync(SAVE_DIAGRAM_DIR)) {
      try {
        await this.execCommand(`${REMOVE_COMMAND_DIR} ${SAVE_DIAGRAM_DIR.replace(/\s/g, '\\ ')}`);
      } catch (error) {
        console.error('Error:clearSavedDiagrams ', error);
      }
    }
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

    await this.ensureVisible('diagram-list', VISIBLE_TIMEOUT);
  }

  public async openThinkViewFromNavbar(): Promise<void> {
    await this.ensureVisible('[data-test-navbar="Think"]', VISIBLE_TIMEOUT);
    await this.clickOn('[data-test-navbar="Think"]');
    await this.ensureVisible('diagram-list', VISIBLE_TIMEOUT);
  }

  public async openStartPage(): Promise<void> {
    return this.openView('');
  }

  public async createAndOpenNewDiagram(): Promise<void> {
    if (!this.creatingFirstDiagram) {
      await this.openStartPage();
    }

    await this.ensureVisible('[data-test-create-new-diagram]', VISIBLE_TIMEOUT);
    await this.clickOn('[data-test-create-new-diagram]');
    await this.ensureVisible('[data-test-navbar-title]', VISIBLE_TIMEOUT);
  }

  public async assertSelectedBpmnElementHasName(name): Promise<void> {
    await this.ensureVisible('[data-test-property-panel-element-name]', VISIBLE_TIMEOUT);
    const selectedElementText = await this.getValueFromElement('[data-test-property-panel-element-name]');

    assert.equal(selectedElementText, name);
  }

  public async rejectSelectedBpmnElementHasName(name): Promise<void> {
    await this.ensureVisible('[data-test-property-panel-element-name]', VISIBLE_TIMEOUT);
    const selectedElementText = await this.getValueFromElement('[data-test-property-panel-element-name]');

    assert.notEqual(selectedElementText, name);
  }

  public async assertDiffViewHasRenderedAllContainer(): Promise<void> {
    const leftDiffViewContainerIsVisible = await this.webdriverClient.isVisible('[data-test-left-diff-view]');
    const rightDiffViewContainerIsVisible = await this.webdriverClient.isVisible('[data-test-right-diff-view]');
    const lowerDiffViewContainerIsVisible = await this.webdriverClient.isVisible('[data-test-lower-diff-view]');

    assert.equal(leftDiffViewContainerIsVisible, true);
    assert.equal(rightDiffViewContainerIsVisible, true);
    assert.equal(lowerDiffViewContainerIsVisible, true);
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
    try {
      await this.app.browserWindow.loadURL(`${APP_BASE_URL}${uriPath}`);
    } catch (error) {
      const errorIsNavigatedError: boolean = error.message.includes('Inspected target navigated or closed');

      if (!errorIsNavigatedError) {
        throw error;
      }
    }
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

  private async removeWindowsDB(dbPath): Promise<void> {
    await new Promise((resolve: Function, reject: Function) => {
      fs.readdirSync(dbPath).forEach((file, index, arr) => {
        const fileToDelete = path.join(dbPath, file);

        const deleteFile = (filepath): void =>
          fs.open(filepath, 'r+', async (err, fd) => {
            if (err && err.code === 'EBUSY') {
              deleteFile(filepath);
            } else if (err && err.code === 'ENOENT') {
              if (index === arr.length - 1) {
                fs.rmdirSync(dbPath);
                resolve();
              }
            } else {
              fs.close(fd, () => {
                fs.unlink(filepath, async (unlinkErr) => {
                  if (unlinkErr) {
                    deleteFile(filepath);
                  } else if (index === arr.length - 1) {
                    try {
                      fs.rmdirSync(dbPath);
                      resolve();
                    } catch (error) {
                      if (error.code === 'ENOTEMPTY') {
                        await this.removeWindowsDB(dbPath);
                        resolve();
                      }
                    }
                  }
                });
              });
            }
          });

        deleteFile(fileToDelete);
      });
    });
  }

  private async deleteFile(fileToDelete): Promise<void> {
    return new Promise((resolve: Function, reject: Function) => {
      const deleteIt = (filepath): void => {
        fs.open(filepath, 'r+', async (err, fd) => {
          if (err && err.code === 'EBUSY') {
            deleteIt(filepath);
          } else if (err && err.code === 'ENOENT') {
            resolve();
          } else {
            fs.close(fd, () => {
              fs.unlink(filepath, async (unlinkErr) => {
                if (unlinkErr) {
                  deleteIt(filepath);
                } else {
                  resolve();
                }
              });
            });
          }
        });
      };

      deleteIt(fileToDelete);
    });
  }
}
