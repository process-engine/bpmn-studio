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

  public attached(): void {
    document.addEventListener('focusin', this.focusEventListener);
  }

  public detached(): void {
    document.removeEventListener('focusin', this.focusEventListener);
  }

  private focusEventListener = (event): void => {
    const focussedElementIsInModalOrTheModal = this.modalRef.contains(event.target);

    if (!focussedElementIsInModalOrTheModal) {
      this.modalRef.focus();
    }
  };
}
