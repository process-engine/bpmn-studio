import {HelpTextId} from '../../contracts/index';

import {HelpTextService} from './help-text-service';

export class HelpModalService {
  public showModal = false;

  private helpTextService: HelpTextService;

  constructor() {
    this.helpTextService = new HelpTextService();
  }

  public showHelpModal(helpTextId: HelpTextId): void {
    this.showModal = !this.showModal;
    const node = document.createElement('div');

    const removeModalFn = (): void => {
      document.body.removeChild(node);
    };

    const helpText = this.helpTextService.getHelpTextById(helpTextId);

    node.innerHTML = `
<div class="modal show show-modal" tabindex="-1" role="dialog">
  <div class="modal-dialog modal-style" style="display: flex; top: 10%; max-height: 80%;" role="document">
    <div class="modal-content" style="height: unset;">
      <div class="modal-header">
        <h3>${helpText.title}</h3>
        <button id="help-modal-close-button" type="button" class="close">&times;</button>
      </div>
      <div class="modal-body" style="overflow-y: scroll;"><span style="white-space: pre-line;">${this.escapeMessage(
        helpText.message,
      )}<span></div>
    </div>
  </div>
</div>
<div class="modal-backdrop fade in"></div>`;

    document.body.appendChild(node);
    document.getElementById('help-modal-close-button').onclick = removeModalFn;
  }

  private escapeMessage(message: string): string {
    return message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
