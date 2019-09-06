import path from 'path';
import fs from 'fs';
import assert from 'assert';
import {TestClient} from '../TestClient';

export class Design {
  private testClient: TestClient;
  private saveDiagramDir: string;

  constructor(testClient: TestClient, saveDiagramDir: string) {
    this.testClient = testClient;
    this.saveDiagramDir = saveDiagramDir;
  }

  public async open(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('detail', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-diagram-detail]');
  }

  public async clickOnBpmnElementWithName(name): Promise<void> {
    await this.testClient.ensureVisible(`.djs-label=${name}`);
    await this.testClient.clickOn(`.djs-label=${name}`);
  }

  public async saveDiagramAs(fileName: string): Promise<void> {
    const fileUri: string = path.join(this.saveDiagramDir, fileName);
    const directoryExists: boolean = await fs.existsSync(this.saveDiagramDir);

    if (!directoryExists) {
      fs.mkdirSync(this.saveDiagramDir);
    }

    await this.testClient.webdriverClient.executeAsync(async (pathToSave, done) => {
      // eslint-disable-next-line no-underscore-dangle
      await (window as any).__dangerouslyInvoke.saveDiagramAs(pathToSave);

      done();
    }, fileUri);
  }

  public async assertCanvasModelIsVisible(): Promise<void> {
    const canvasModelIsVisible = await this.testClient.webdriverClient.isVisible('[data-test-canvas-model]');
    assert.equal(canvasModelIsVisible, true);
  }
}
