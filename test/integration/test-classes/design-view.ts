import path from 'path';
import fs from 'fs';
import {TestClient} from '../TestClient';

export class Design {
  private testClient: TestClient;
  private saveDiagramDir: string;

  constructor(testClient: TestClient, saveDiagramDir: string) {
    this.testClient = testClient;
    this.saveDiagramDir = saveDiagramDir;
  }

  public async openDetailView(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('detail', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-diagram-detail]');
  }

  public async openXmlView(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('xml', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-bpmn-xml-view]');
  }

  public async openDiffView(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('diff', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-bpmn-diff-view]');
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

  public async startProcess(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-start-diagram-button]');
    await this.testClient.clickOn('[data-test-start-diagram-button]');
    await this.testClient.ensureVisible('[data-test-live-execution-tracker]');
  }

  public async deployDiagram(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-deploy-diagram-button]');
    await this.testClient.clickOn('[data-test-deploy-diagram-button]');
  }

  // openXMLViewForCurrentDiagram?
  public async openXmlViewFromStatusbar(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-status-bar-xml-view-button]');
    await this.testClient.clickOn('[data-test-status-bar-xml-view-button]');
    await this.testClient.ensureVisible('[data-test-bpmn-xml-view]');
  }

  // openDesignViewForCurrentDiagram?
  public async openDetailViewFromStatusbar(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-status-bar-disable-xml-view-button]');
    await this.testClient.clickOn('[data-test-status-bar-disable-xml-view-button]');
    await this.testClient.ensureVisible('[data-test-diagram-detail]');
  }
}
