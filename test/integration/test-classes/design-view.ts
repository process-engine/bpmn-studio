/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';
import path from 'path';
import fs from 'fs';
import assert from 'assert';

import {GlobalMethods} from './global-methods';

export class Design extends GlobalMethods {
  private saveDiagramDir: string;

  constructor(app: Application, saveDiagramDir: string) {
    super(app);
    this.saveDiagramDir = saveDiagramDir;
  }

  public async open(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.openDesignView('detail', diagramName, diagramUri, solutionUri);
    await this.ensureVisible('[data-test-diagram-detail]');
  }

  public async clickOnBpmnElementWithName(name): Promise<void> {
    await this.ensureVisible(`.djs-label=${name}`);
    await this.clickOn(`.djs-label=${name}`);
  }

  public async saveDiagramAs(fileName: string): Promise<void> {
    const fileUri: string = path.join(this.saveDiagramDir, fileName);
    const directoryExists: boolean = await fs.existsSync(this.saveDiagramDir);

    if (!directoryExists) {
      fs.mkdirSync(this.saveDiagramDir);
    }

    await this.webdriverClient.executeAsync(async (pathToSave, done) => {
      // eslint-disable-next-line no-underscore-dangle
      await (window as any).__dangerouslyInvoke.saveDiagramAs(pathToSave);

      done();
    }, fileUri);
  }

  public async assertCanvasModelIsVisible(): Promise<void> {
    const canvasModelIsVisible = await this.webdriverClient.isVisible('[data-test-canvas-model]');
    assert.equal(canvasModelIsVisible, true);
  }
}
