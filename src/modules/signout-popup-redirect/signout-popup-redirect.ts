import {inject} from 'aurelia-framework';

import {OpenIdConnect} from 'aurelia-open-id-connect';

@inject(OpenIdConnect)
export class PopupRedirect {
  private openIdConnect: OpenIdConnect;

  constructor(openIdConnect: OpenIdConnect) {
    this.openIdConnect = openIdConnect;
  }

  public activate(): void {
    this.openIdConnect.userManager.signoutPopupCallback(window.location.href, false);
  }
}
