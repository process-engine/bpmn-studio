import {browser, by, element, ElementArrayFinder, ElementFinder, ExpectedConditions} from 'protractor';

import {By} from 'selenium-webdriver';

export class XmlView {

  public url: string;

  private _xmlViewContainerId: string = 'diagramXmlContainer';

  constructor(applicationUrl: string, diagramName: string) {
    this.url = `${applicationUrl}/design/xml/diagram/${diagramName}?solutionUri=http%3A%2F%2Flocalhost%3A8000`;
    this.url = `${applicationUrl}/design?diagramName=${diagramName}&solutionUri=http%3A%2F%2Flocalhost%3A8000&view=xml`;
  }

  public async show(): Promise<void> {
    await browser.get(this.url);

    await browser.wait(ExpectedConditions.visibilityOf(this._xmlViewContainer), browser.params.defaultTimeoutMS);
  }

  public async getVisibilityOfXmlViewContainer(): Promise<boolean> {
    this._waitForVisbilityOfElement(this._xmlViewContainer);

    return this._xmlViewContainer.isDisplayed();
  }

  public async getVisbilityOfXMLCodeBlock(): Promise<boolean> {
    this._waitForVisbilityOfElement(this._xmlCodeBlock);

    return this._xmlViewContainer.isDisplayed();
  }

  public async getVisbilityOfLineNumbers(): Promise<boolean> {
    this._waitForVisbilityOfElement(this._lineNumbers.first());

    return this._lineNumbers.isDisplayed();
  }

  public async getVisbilityOfCodeLines(): Promise<boolean> {
    this._waitForVisbilityOfElement(this._codeLines.first());

    return this._codeLines.isDisplayed();
  }

  private async _waitForVisbilityOfElement(finder: ElementFinder): Promise<void> {
    const finderVisibility: Function = ExpectedConditions.visibilityOf(finder);

    await browser.wait(finderVisibility, browser.params.defaultTimeoutMS).catch(() => {
      // If this timeouts do nothing.
      // We are basically supressing the timeout error here.
      // This way we get better error messages for debugging by the actual test function.
    });
  }

  private get _xmlViewContainer(): ElementFinder {
    const xmlViewContainerById: By = by.id(this._xmlViewContainerId);

    return element(xmlViewContainerById);
  }

  private get _xmlCodeBlock(): ElementFinder {
    const codeBlockByTag: By = by.tagName('code');

    return element(codeBlockByTag);
  }

  private get _lineNumbers(): ElementArrayFinder {
    const lineNumbersByCss: By = by.css('hljs-ln-numbers');

    return element.all(lineNumbersByCss);
  }

  private get _codeLines(): ElementArrayFinder {
    const codeLinesByCss: By = by.css('hljs-ln-code');

    return element.all(codeLinesByCss);
  }
}
