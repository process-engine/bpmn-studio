import {TestClient} from '../TestClient';

export class LiveExecutionTracker {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
  }

  public async stopProcess(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-stop-process-button]');
    await this.testClient.clickOn('[data-test-stop-process-button]');
    await this.testClient.ensureNotVisible('[data-test-stop-process-button]');
  }
}
