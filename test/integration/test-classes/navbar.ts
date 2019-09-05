/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';
import assert from 'assert';

import {GlobalMethods} from './global-methods';

export class Navbar extends GlobalMethods {
  constructor(app: Application) {
    super(app);
  }

  public async startProcess(): Promise<void> {
    await this.ensureVisible('[data-test-start-diagram-button]');
    await this.clickOn('[data-test-start-diagram-button]');
    await this.ensureVisible('[data-test-live-execution-tracker]');
  }

  public async deployDiagram(): Promise<void> {
    await this.ensureVisible('[data-test-deploy-diagram-button]');
    await this.clickOn('[data-test-deploy-diagram-button]');
  }

  public async assertDiagramIsOnFileSystem(): Promise<void> {
    await this.ensureVisible('[data-test-navbar-icon]');
    const classAttribute = await this.getAttributeFromElement('[data-test-navbar-icon]', 'data-test-navbar-icon');

    assert.equal(classAttribute, 'false');
  }

  public async assertDiagramIsOnProcessEngine(): Promise<void> {
    await this.ensureVisible('[data-test-navbar-icon]');
    const classAttribute = await this.getAttributeFromElement('[data-test-navbar-icon]', 'data-test-navbar-icon');

    assert.equal(classAttribute, 'true');
  }

  public async assertTitleIs(name): Promise<void> {
    await this.ensureVisible('[data-test-navbar-title]');
    const navbarTitle = await this.getTextFromElement('[data-test-navbar-title]');

    assert.equal(navbarTitle, name);
  }

  public async openThinkView(): Promise<void> {
    await this.ensureVisible('[data-test-navbar="Think"]');
    await this.clickOn('[data-test-navbar="Think"]');
    await this.ensureVisible('diagram-list');
  }

  public async assertDiagramIsSaved(): Promise<void> {
    await this.ensureNotVisible('[data-test-edited-label]');
  }

  public async assertDiagramIsUnsaved(): Promise<void> {
    await this.ensureVisible('[data-test-edited-label]');
  }
}
