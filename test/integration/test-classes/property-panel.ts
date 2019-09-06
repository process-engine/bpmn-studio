import assert from 'assert';
import {TestClient} from '../TestClient';

export class PropertyPanel {
  private testClient: TestClient;

  constructor(testClient: TestClient) {
    this.testClient = testClient;
  }

  public async show(): Promise<void> {
    const propertyPanelIsVisible = await this.testClient.webdriverClient.isVisible('[data-test-property-panel]');
    if (propertyPanelIsVisible) {
      return;
    }

    await this.testClient.ensureVisible('[data-test-toggle-propertypanel]');
    await this.testClient.clickOn('[data-test-toggle-propertypanel]');
  }

  public async hide(): Promise<void> {
    const propertyPanelIsVisible = await this.testClient.webdriverClient.isVisible('[data-test-property-panel]');
    const propertyPanelIsHidden = !propertyPanelIsVisible;
    if (propertyPanelIsHidden) {
      return;
    }

    await this.testClient.ensureVisible('[data-test-toggle-propertypanel]');
    await this.testClient.clickOn('[data-test-toggle-propertypanel]');
  }

  public async assertSelectedBpmnElementHasName(name): Promise<void> {
    const selectedElementText = await this.testClient.getValueFromElement('[data-test-property-panel-element-name]');

    assert.equal(selectedElementText, name);
  }

  public async rejectSelectedBpmnElementHasName(name): Promise<void> {
    const selectedElementText = await this.testClient.getValueFromElement('[data-test-property-panel-element-name]');

    assert.notEqual(selectedElementText, name);
  }
}
