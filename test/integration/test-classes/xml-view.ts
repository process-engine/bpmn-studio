import assert from 'assert';
import {TestClient} from '../TestClient';

export class XmlView {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
  }

  public async open(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('xml', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-bpmn-xml-view]');
  }

  public async hasContent(): Promise<void> {
    const xmlViewContent = await this.testClient.getTextFromElement('[data-test-xml-view-content]');
    assert.notEqual(xmlViewContent, null);
  }

  public async assertContainsText(text: string): Promise<void> {
    const xmlViewContent = await this.testClient.getTextFromElement('[data-test-xml-view-content]');
    const xmlViewContentContainsText: boolean = xmlViewContent.includes(text);

    assert.equal(xmlViewContentContainsText, true);
  }
}
