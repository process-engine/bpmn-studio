export class HelpModalService {
  public showModal = false;

  public showHelpModal(headline: string, message: string): void {
    this.showModal = !this.showModal;
    const node = document.createElement('div');

    const removeModalFn = (): void => {
      console.log('remove');
      document.body.removeChild(node);
    };

    node.innerHTML = `
<div class="modal show show-modal" tabindex="-1" role="dialog">
  <div class="modal-dialog modal-style" style="display: flex; top: 10%; max-height: 80%;" role="document">
    <div class="modal-content" style="height: unset;">
      <div class="modal-header">
        <h3>${headline}</h3>
        <button id="help-modal-close-button" type="button" class="close">&times;</button>
      </div>
      <div class="modal-body" style="overflow-y: scroll;"><span style="white-space: pre-line;">${this.escapeMessage(
        message,
      )}<span></div>
    </div>
  </div>
</div>
<div class="modal-backdrop fade in"></div>`;

    document.body.appendChild(node);
    document.getElementById('help-modal-close-button').onclick = removeModalFn;
  }

  private escapeMessage(message): string {
    return message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
