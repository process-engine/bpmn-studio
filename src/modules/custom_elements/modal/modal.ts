import {bindable} from 'aurelia-framework';

export class ModalCustomElement {
  @bindable public modalStyle;
  @bindable public contentStyle;
  @bindable public headerStyle;
  @bindable public bodyStyle;
  @bindable public footerStyle;
  @bindable public headerText;
  @bindable public bodyText;
  @bindable public footerText;
  @bindable public origin;

  private modalRef: HTMLDivElement;

  public bind(): void {
    document.addEventListener('focusin', this.focusEventListener);
  }

  public unbind(): void {
    document.removeEventListener('focusin', this.focusEventListener);
  }

  private focusEventListener = (event): void => {
    const focussedElementIsInModalOrTheModal =
      this.modalRef.contains(event.target) || event.target.className.includes('modal show show-modal');

    if (!focussedElementIsInModalOrTheModal) {
      this.modalRef.focus();
    }
  };
}
