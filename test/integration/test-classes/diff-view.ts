import assert from 'assert';
import {TestClient} from '../TestClient';

export class DiffView {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
  }

  public async open(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.testClient.openDesignView('diff', diagramName, diagramUri, solutionUri);
    await this.testClient.ensureVisible('[data-test-bpmn-diff-view]');
  }

  public async assertHasRenderedAllContainer(): Promise<void> {
    const leftDiffViewContainerIsVisible = await this.testClient.webdriverClient.isVisible(
      '[data-test-left-diff-view]',
    );
    const rightDiffViewContainerIsVisible = await this.testClient.webdriverClient.isVisible(
      '[data-test-right-diff-view]',
    );
    const lowerDiffViewContainerIsVisible = await this.testClient.webdriverClient.isVisible(
      '[data-test-lower-diff-view]',
    );

    assert.equal(leftDiffViewContainerIsVisible, true);
    assert.equal(rightDiffViewContainerIsVisible, true);
    assert.equal(lowerDiffViewContainerIsVisible, true);
  }
}
