/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';
import assert from 'assert';
import {TestClient} from '../TestClient';

export class PropertyPanel {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
  }

  public async show(): Promise<void> {
    const propertyPanelIsVisible = await this.webdriverClient.isVisible('[data-test-property-panel]');
    if (propertyPanelIsVisible) {
      return;
    }

    await this.ensureVisible('[data-test-toggle-propertypanel]');
    await this.clickOn('[data-test-toggle-propertypanel]');
  }

  public async hide(): Promise<void> {
    const propertyPanelIsVisible = await this.webdriverClient.isVisible('[data-test-property-panel]');
    const propertyPanelIsHidden = !propertyPanelIsVisible;
    if (propertyPanelIsHidden) {
      return;
    }

    await this.ensureVisible('[data-test-toggle-propertypanel]');
    await this.clickOn('[data-test-toggle-propertypanel]');
  }

  public async assertSelectedBpmnElementHasName(name): Promise<void> {
    const selectedElementText = await this.getValueFromElement('[data-test-property-panel-element-name]');

    assert.equal(selectedElementText, name);
  }

  public async rejectSelectedBpmnElementHasName(name): Promise<void> {
    const selectedElementText = await this.getValueFromElement('[data-test-property-panel-element-name]');

    assert.notEqual(selectedElementText, name);
  }
}
