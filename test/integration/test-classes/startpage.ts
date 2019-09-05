/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';

import {GlobalMethods} from './global-methods';

export class StartPage extends GlobalMethods {
  constructor(app: Application) {
    super(app);
  }

  public async open(): Promise<void> {
    return this.openView('');
  }

  public async createAndOpenNewDiagram(): Promise<void> {
    await this.ensureVisible('[data-test-create-new-diagram]');
    await this.clickOn('[data-test-create-new-diagram]');
    await this.ensureVisible('[data-test-navbar-title]');
  }
}
