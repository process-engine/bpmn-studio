import {TestClient} from '../TestClient';

export class Statusbar {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
  }

  // openXMLViewForCurrentDiagram?
  public async openXmlView(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-status-bar-xml-view-button]');
    await this.testClient.clickOn('[data-test-status-bar-xml-view-button]');
    await this.testClient.ensureVisible('[data-test-bpmn-xml-view]');
  }

  // openDesignViewForCurrentDiagram?
  public async openDesignView(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-status-bar-disable-xml-view-button]');
    await this.testClient.clickOn('[data-test-status-bar-disable-xml-view-button]');
    await this.testClient.ensureVisible('[data-test-diagram-detail]');
  }
}
