/* eslint-disable @typescript-eslint/no-useless-constructor */
/* eslint-disable no-useless-constructor */
import {Application} from 'spectron';

import {GlobalMethods} from './global-methods';

export class Statusbar extends GlobalMethods {
  constructor(app: Application) {
    super(app);
  }

  // openXMLViewForCurrentDiagram?
  public async openXmlView(): Promise<void> {
    await this.ensureVisible('[data-test-status-bar-xml-view-button]');
    await this.clickOn('[data-test-status-bar-xml-view-button]');
    await this.ensureVisible('[data-test-bpmn-xml-view]');
  }

  // openDesignViewForCurrentDiagram?
  public async openDesignView(): Promise<void> {
    await this.ensureVisible('[data-test-status-bar-disable-xml-view-button]');
    await this.clickOn('[data-test-status-bar-disable-xml-view-button]');
    await this.ensureVisible('[data-test-diagram-detail]');
  }
}
