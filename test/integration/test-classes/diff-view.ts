/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';
import assert from 'assert';

import {GlobalMethods} from './global-methods';

export class DiffView extends GlobalMethods {
  constructor(app: Application) {
    super(app);
  }

  public async open(diagramName: string, diagramUri: string, solutionUri?: string): Promise<void> {
    await this.openDesignView('diff', diagramName, diagramUri, solutionUri);
    await this.ensureVisible('[data-test-bpmn-diff-view]');
  }

  public async assertHasRenderedAllContainer(): Promise<void> {
    const leftDiffViewContainerIsVisible = await this.webdriverClient.isVisible('[data-test-left-diff-view]');
    const rightDiffViewContainerIsVisible = await this.webdriverClient.isVisible('[data-test-right-diff-view]');
    const lowerDiffViewContainerIsVisible = await this.webdriverClient.isVisible('[data-test-lower-diff-view]');

    assert.equal(leftDiffViewContainerIsVisible, true);
    assert.equal(rightDiffViewContainerIsVisible, true);
    assert.equal(lowerDiffViewContainerIsVisible, true);
  }
}
