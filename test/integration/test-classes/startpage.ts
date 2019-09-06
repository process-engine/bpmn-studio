import {TestClient} from '../TestClient';

export class StartPage {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
  }

  public async open(): Promise<void> {
    return this.testClient.openView('');
  }

  public async createAndOpenNewDiagram(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-create-new-diagram]');
    await this.testClient.clickOn('[data-test-create-new-diagram]');
    await this.testClient.ensureVisible('[data-test-navbar-title]');
  }
}
