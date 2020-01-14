import path from 'path';
import fs from 'fs';
import {TestClient} from '../TestClient';
import {callExposedFunction} from '../../../src/services/expose-functionality-module/expose-functionality.module';

const VISIBLE_TIMEOUT = 40000;
export class DesignViewClient {
  private testClient: TestClient;
  private saveDiagramDir: string;

  constructor(testClient: TestClient, saveDiagramDir: string) {
    this.testClient = testClient;
    this.saveDiagramDir = saveDiagramDir;
  }

  public async openDetailView(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('detail', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-diagram-detail]', VISIBLE_TIMEOUT);
  }

  public async openXmlView(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('xml', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-bpmn-xml-view]', VISIBLE_TIMEOUT);
  }

  public async openDiffView(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('diff', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-bpmn-diff-view]', VISIBLE_TIMEOUT);
  }

  public async saveDiagramAs(fileName: string): Promise<void> {
    const fileUri: string = path.join(this.saveDiagramDir, fileName);
    const directoryExists: boolean = await fs.existsSync(this.saveDiagramDir);

    if (!directoryExists) {
      fs.mkdirSync(this.saveDiagramDir);
    }

    await callExposedFunction(this.testClient.webdriverClient, 'saveDiagramAs', fileUri);
  }

  public async startProcess(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-start-diagram-button]', VISIBLE_TIMEOUT);
    await this.testClient.clickOn('[data-test-start-diagram-button]');
    await this.testClient.ensureVisible('[data-test-live-execution-tracker]', VISIBLE_TIMEOUT);
  }

  public async deployDiagram(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-deploy-diagram-button]', VISIBLE_TIMEOUT);
    await this.testClient.solutionExplorer.assertInternalProcessEngineIsConnected();
    await this.testClient.clickOn('[data-test-deploy-diagram-button]');
  }

  // openXMLViewForCurrentDiagram?
  public async openXmlViewFromStatusbar(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-status-bar-xml-view-button]', VISIBLE_TIMEOUT);
    await this.testClient.clickOn('[data-test-status-bar-xml-view-button]');
  }

  // openDesignViewForCurrentDiagram?
  public async openDetailViewFromStatusbar(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-status-bar-disable-xml-view-button]', VISIBLE_TIMEOUT);
    await this.testClient.clickOn('[data-test-status-bar-disable-xml-view-button]');
    await this.testClient.ensureVisible('[data-test-diagram-detail]', VISIBLE_TIMEOUT);
  }

  public async assertXmlViewIsVisible(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-bpmn-xml-view]', VISIBLE_TIMEOUT);
  }

  public async showPropertyPanel(): Promise<void> {
    const propertyPanelIsVisible = await this.testClient.webdriverClient.isVisible('[data-test-property-panel]');
    if (propertyPanelIsVisible) {
      return;
    }

    await this.testClient.ensureVisible('[data-test-toggle-propertypanel]', VISIBLE_TIMEOUT);
    await this.testClient.clickOn('[data-test-toggle-propertypanel]');
  }

  public async hidePropertyPanel(): Promise<void> {
    const propertyPanelIsVisible = await this.testClient.webdriverClient.isVisible('[data-test-property-panel]');
    const propertyPanelIsHidden = !propertyPanelIsVisible;
    if (propertyPanelIsHidden) {
      return;
    }

    await this.testClient.ensureVisible('[data-test-toggle-propertypanel]', VISIBLE_TIMEOUT);
    await this.testClient.clickOn('[data-test-toggle-propertypanel]');
  }
}
