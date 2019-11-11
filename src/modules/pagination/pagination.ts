import {bindable, computedFrom, inject} from 'aurelia-framework';
import {BindingSignaler} from 'aurelia-templating-resources';

@inject(BindingSignaler)
export class Pagination {
  @bindable public perPage: number = 0;
  @bindable public items: number = 0;
  @bindable public maxPagesToDisplay: number = -1;
  @bindable public currentPage: number = 1;
  @bindable public contentIsAsync: boolean;
  @bindable public isLoading: boolean = false;

  public previousPage: number = 0;
  public pageStartValue: number = 1;

  public signaler: BindingSignaler;

  constructor(signaler: BindingSignaler) {
    this.signaler = signaler;
  }

  public isLoadingChanged(): void {
    if (!this.contentIsAsync) {
      return;
    }

    this.signaler.signal('update-page-class');
  }

  public currentPageChanged(currentPage: number, previousPage: number): void {
    const currentPageDoesNotGetDisplayed: boolean =
      this.currentPage < this.pageStartValue || this.currentPage > this.pageStartValue + this.maxPagesToDisplay - 1;

    if (currentPageDoesNotGetDisplayed) {
      const pageIndex = this.currentPage % this.maxPagesToDisplay;
      this.pageStartValue = this.currentPage - pageIndex + 1;
    }

    if (this.contentIsAsync) {
      if (!this.isLoading) {
        this.previousPage = previousPage;
      }

      this.isLoading = true;
    }

    this.signaler.signal('update-page-class');
  }

  public setCurrentPage(page: number): void {
    this.currentPage = page;
  }

  public showPreviousPage(): void {
    if (this.currentPageIsFirstPage) {
      return;
    }

    this.currentPage--;

    if (this.currentPage < this.pageStartValue) {
      this.showPagesBeforeCurrentLimit();
    }
  }

  public showNextPage(): void {
    if (this.currentPageIsLastPage) {
      return;
    }

    this.currentPage++;

    if (this.currentPage > this.pageStartValue + this.maxPagesToDisplay - 1) {
      this.showPagesAfterCurrentLimit();
    }
  }

  public showFirstPage(): void {
    this.currentPage = 1;
    this.pageStartValue = 1;
  }

  public showLastPage(): void {
    this.currentPage = this.amountOfPages;

    const amountOfPagesToDisplayWhenShowingLastPage: number = (this.amountOfPages % this.maxPagesToDisplay) - 1;
    this.pageStartValue = this.amountOfPages - amountOfPagesToDisplayWhenShowingLastPage;
  }

  public showPagesBeforeCurrentLimit(): void {
    this.pageStartValue -= this.maxPagesToDisplay;
    this.currentPage = this.pageStartValue + this.maxPagesToDisplay - 1;
  }

  public showPagesAfterCurrentLimit(): void {
    this.pageStartValue += this.maxPagesToDisplay;
    this.currentPage = this.pageStartValue;
  }

  public getClassForPageIndex(pageIndex: number): string {
    const pageNumber: number = pageIndex + this.pageStartValue;

    const isCurrentPage: boolean = this.currentPage === pageNumber;
    if (isCurrentPage) {
      return this.isLoading ? 'pagination-button--loading' : 'active';
    }

    const isPreviousPage: boolean = this.previousPage === pageNumber;
    if (isPreviousPage) {
      return this.isLoading ? 'active' : '';
    }

    return '';
  }

  @computedFrom('items', 'perPage')
  public get amountOfPages(): number {
    return Math.ceil(this.items / this.perPage);
  }

  @computedFrom('amountOfPages', 'maxPagesToDisplay')
  public get showLimitedAmountOfPages(): boolean {
    return this.maxPagesToDisplay > 0 && this.amountOfPages > this.maxPagesToDisplay;
  }

  @computedFrom('pageStartValue')
  public get firstPagesGetDisplayed(): boolean {
    return this.pageStartValue === 1;
  }

  @computedFrom('pageStartValue', 'maxPagesToDisplay', 'amountOfPages')
  public get lastPagesGetDisplayed(): boolean {
    return this.pageStartValue + this.maxPagesToDisplay > this.amountOfPages;
  }

  @computedFrom('maxPagesToDisplay', 'pageStartValue', 'amountOfPages')
  public get amountOfPagesToDisplay(): number {
    if (this.showLimitedAmountOfPages) {
      const lessPagesThanMaxPagesToDisplayAvailable: boolean =
        this.pageStartValue + this.maxPagesToDisplay > this.amountOfPages;
      if (lessPagesThanMaxPagesToDisplayAvailable) {
        return this.amountOfPages - this.pageStartValue + 1;
      }

      return this.maxPagesToDisplay;
    }

    return this.amountOfPages;
  }

  @computedFrom('currentPage', 'amountOfPages')
  public get currentPageIsLastPage(): boolean {
    return this.currentPage === this.amountOfPages;
  }

  @computedFrom('currentPage')
  public get currentPageIsFirstPage(): boolean {
    return this.currentPage === 1;
  }
}
