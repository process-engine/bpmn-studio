import assert from 'assert';
import {TestClient} from '../TestClient';

export class Navbar {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
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

  public async assertDiagramIsOnFileSystem(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-navbar-icon]');
    const classAttribute = await this.testClient.getAttributeFromElement(
      '[data-test-navbar-icon]',
      'data-test-navbar-icon',
    );

    assert.equal(classAttribute, 'false');
  }

  public async assertDiagramIsOnProcessEngine(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-navbar-icon]');
    const classAttribute = await this.testClient.getAttributeFromElement(
      '[data-test-navbar-icon]',
      'data-test-navbar-icon',
    );

    assert.equal(classAttribute, 'true');
  }

  public async assertTitleIs(name): Promise<void> {
    await this.testClient.ensureVisible('[data-test-navbar-title]');
    const navbarTitle = await this.testClient.getTextFromElement('[data-test-navbar-title]');

    assert.equal(navbarTitle, name);
  }

  public async openThinkView(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-navbar="Think"]');
    await this.testClient.clickOn('[data-test-navbar="Think"]');
    await this.testClient.ensureVisible('diagram-list');
  }

  public async assertDiagramIsSaved(): Promise<void> {
    await this.testClient.ensureNotVisible('[data-test-edited-label]');
  }

  public async assertDiagramIsUnsaved(): Promise<void> {
    await this.testClient.ensureVisible('[data-test-edited-label]');
  }
}
