/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';

import {GlobalMethods} from './global-methods';

export class LiveExecutionTracker extends GlobalMethods {
  constructor(app: Application) {
    super(app);
  }

  public async stopProcess(): Promise<void> {
    await this.ensureVisible('[data-test-stop-process-button]');
    await this.clickOn('[data-test-stop-process-button]');
    await this.ensureNotVisible('[data-test-stop-process-button]');
  }
}
