/* eslint-disable no-empty-function */
import {Application, SpectronWebContents} from 'spectron';

import url from 'url';

export class TestClient {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  public async awaitReadyness(): Promise<void> {
    return this.app.client.waitUntilWindowLoaded();
  }

  public async openViaCommandPalette(query: string): Promise<void> {
    await this.sendKeyboardInput(['cmd-shift-k']);
    await this.sendKeyboardInput(query.split(''));
    await this.sendKeyboardInput(['enter']);
  }

  public async openViaQuickJump(query: string): Promise<void> {
    await this.sendKeyboardInput(['cmd-k']);
    await this.sendKeyboardInput(query.split(''));
    await this.sendKeyboardInput(['enter']);
  }

  public async focusElement(windowId, selector): Promise<void> {}

  public async getElements(windowId, selector): Promise<void> {}

  public async getWindowIds(): Promise<void> {}

  public async getElement(selector): Promise<any> {
    const client: any = this.app.client;

    return client.element(selector);
  }

  public async navigateToStartPage(): Promise<void> {
    return this.app.browserWindow.loadURL(`file://${__dirname}/../../index.html`);
  }

  public async navigateToDetailView(diagramName, diagramUri, solutionUri?): Promise<void> {
    const unformattedURL = `file://${__dirname}/../../index.html#/design/detail/diagram/${diagramName}?diagramUri=${diagramUri}&solutionUri=${solutionUri}`;
    const formattedURL = url.format(unformattedURL);

    return this.app.browserWindow.loadURL(formattedURL);
  }

  public async navigateToXMLView(diagramName, diagramUri, solutionUri?): Promise<void> {
    const unformattedURL = `file://${__dirname}/../../index.html#/design/xml/diagram/${diagramName}?diagramUri=${diagramUri}&solutionUri=${solutionUri}`;
    const formattedURL = url.format(unformattedURL);

    return this.app.browserWindow.loadURL(formattedURL);
  }

  public async navigateToDiffView(diagramName, diagramUri, solutionUri?): Promise<void> {
    const unformattedURL = `file://${__dirname}/../../index.html#/design/diff/diagram/${diagramName}?diagramUri=${diagramUri}&solutionUri=${solutionUri}`;
    const formattedURL = url.format(unformattedURL);

    return this.app.browserWindow.loadURL(formattedURL);
  }

  public async getAttributeFromElement(selector, attribute): Promise<string> {
    const client: any = this.app.client;

    return client.getAttribute(selector, attribute);
  }

  public async getTextFromElement(selector): Promise<string> {
    const client: any = this.app.client;

    return client.getText(selector);
  }

  public async getValueFromElement(selector): Promise<string> {
    const client: any = this.app.client;

    return client.getValue(selector);
  }

  public async elementHasText(selector, text): Promise<void> {
    return this.app.client.waitUntilTextExists(selector, text);
  }

  public async ensureVisible(selector: string): Promise<boolean> {
    const client: any = this.app.client;
    return client.waitForVisible(selector);
  }

  public async ensureNotVisible(selector: string): Promise<boolean> {
    const client: any = this.app.client;

    const collection = await client.elements(selector);

    return collection.value.length === 0;
  }

  public async clickOn(selector: string): Promise<any> {
    const client: any = this.app.client;

    return client.$(selector).leftClick();
  }

  public async sendKeyboardInput(keys): Promise<void> {
    const webContents = this.getWebContents();

    for (const key of keys) {
      const eventOptsArray = this.getEventsForKeystrokes(key);

      for (const eventOpts of eventOptsArray) {
        for (const type of ['keydown', 'char', 'keyup']) {
          const typeOpts = {type};
          const opts = {...typeOpts, ...eventOpts};

          webContents.sendInputEvent(opts);
        }

        await this.pause(50);
      }
    }
  }

  public async pause(timeInMilliseconds: number): Promise<void> {
    await new Promise((c: any): any => setTimeout(c, timeInMilliseconds));
  }

  private getWebContents(): SpectronWebContents {
    return this.app.webContents;
  }

  public getEventsForKeystrokes(keystrokes: string): Array<any> {
    if (keystrokes === ' ') {
      return [this.getOptionsForKey(' ')];
    }

    return keystrokes.split(' ').map((keystroke) => {
      const keys = keystroke.split('-');
      const options = keys.reduce((memo: any, key: string) => {
        memo = memo || {};
        const opts = this.getOptionsForKey(key);
        const result = {...memo, ...opts};
        const modifiers = memo.modifiers || [];

        result.modifiers = modifiers.concat(opts.modifiers);

        return result;
      }, {});

      return options;
    });
  }

  public getOptionsForKey(key): any {
    const opts: any = {modifiers: []};

    if (key === 'cmd' || key === 'meta') {
      opts.modifiers.push('cmd');
    }
    if (key === 'ctrl') {
      opts.modifiers.push('ctrl');
    }
    if (key === 'shift') {
      opts.modifiers.push('shift');
    }
    if (key === 'alt') {
      opts.modifiers.push('alt');
    }
    if (key === 'space') {
      opts.key = ' ';
    }

    if (!opts.key) {
      opts.key = key;
    }
    if (!opts.keyCode) {
      opts.keyCode = opts.key;
    }

    return opts;
  }
}
