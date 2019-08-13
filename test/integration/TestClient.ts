import {Application, SpectronWebContents} from 'spectron';

export class TestClient {
  private app: Application;
  private client: any;

  constructor(app: Application) {
    this.app = app;
    // this is done due to conflicting types for @types/webdriverio < 5.0.0
    this.client = app.client as any;
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

  public async focusElement(windowId, selector) {}

  public async getElements(windowId, selector) {}

  public async getWindowIds() {}

  public async ensureVisible(selector: string): Promise<boolean> {
    return this.client.waitForVisible(selector);
  }

  public async ensureNotVisible(selector: string): Promise<boolean> {
    const collection = await this.client.elements(selector);

    return collection.value.length === 0;
  }

  public async clickOn(selector: string): Promise<any> {
    return this.client.$(selector).leftClick();
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
