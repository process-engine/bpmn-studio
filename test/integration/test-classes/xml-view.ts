/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';
import assert from 'assert';

export class XmlView {
  private testClient: TestClient;

export class XmlView extends GlobalMethods {
  constructor(app: Application) {
    super(app);
  }

  public async open(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.openDesignView('xml', diagramName, diagramUri, solutionUri);
    await this.ensureVisible('[data-test-bpmn-xml-view]');
  }

  public async hasContent(): Promise<void> {
    const xmlViewContent = await this.getTextFromElement('[data-test-xml-view-content]');
    assert.notEqual(xmlViewContent, null);
  }

  public async assertContainsText(text: string): Promise<void> {
    const xmlViewContent = await this.getTextFromElement('[data-test-xml-view-content]');
    const xmlViewContentContainsText: boolean = xmlViewContent.includes(text);

    assert.equal(xmlViewContentContainsText, true);
  }
}
