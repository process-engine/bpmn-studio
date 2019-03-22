import {browser, by, element, ElementArrayFinder, ElementFinder, ExpectedConditions} from 'protractor';

import {By} from 'selenium-webdriver';

export class DiagramDetail {

  public url: string;

  private _diagramDetailContainerId: string = 'diagramDetailContainer';
  private _bpmnioContainerTag: string = 'bpmn-io';

  constructor(applicationUrl: string, diagramName: string) {
    this.url = `${applicationUrl}/design/detail/diagram/${diagramName}?solutionUri=http%3A%2F%2Flocalhost%3A8000`;
    this.url = `${applicationUrl}/design?diagramName=${diagramName}&solutionUri=http%3A%2F%2Flocalhost%3A8000&view=detail`;
  }

  public async show(): Promise<void> {
    await browser.get(this.url);

    await browser.wait(ExpectedConditions.visibilityOf(this._diagramDetailContainer), browser.params.defaultTimeoutMS);
  }

  public async clickOnElement(elementId: string): Promise<void> {
    await browser.wait(ExpectedConditions.visibilityOf(this._bpmnIoContainer), browser.params.defaultTimeoutMS);

    const cssString: string = `[data-element-id="${elementId}"]`;

    const elementByCss: By = by.css(cssString);
    const bpmnElements: ElementArrayFinder = element.all(elementByCss);

    return bpmnElements.first().click();
  }

  public async getVisibilityOfDiagramDetailContainer(): Promise<boolean> {
    await browser.wait(ExpectedConditions.visibilityOf(this._diagramDetailContainer), browser.params.defaultTimeoutMS);

    return this._diagramDetailContainer.isDisplayed();
  }

  public async getVisibilityOfBpmnIoContainer(): Promise<boolean> {
    await browser.wait(ExpectedConditions.visibilityOf(this._bpmnIoContainer), browser.params.defaultTimeoutMS);

    return this._bpmnIoContainer.isDisplayed();
  }

  private get _diagramDetailContainer(): ElementFinder {
    const diagramDetailContainerById: By = by.id(this._diagramDetailContainerId);

    return element(diagramDetailContainerById);
  }

  private get _bpmnIoContainer(): ElementFinder {
    const bpmnIoContainerByTag: By =  by.tagName(this._bpmnioContainerTag);

    return element(bpmnIoContainerByTag);
  }
}
