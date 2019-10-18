import {bindable, computedFrom} from 'aurelia-framework';

export class Pagination {
  @bindable public perPage: number;
  @bindable public items: number;
  @bindable public maxPagesToDisplay: number = -1;
  @bindable public currentPage;

  public pageStartValue: number = 1;

  @computedFrom('items', 'perPage')
  public get amountOfPages(): number {
    return Math.ceil(this.items / this.perPage);
  }

  public setCurrentPage(page: number): void {
    this.currentPage = page;
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
    return this.pageStartValue + this.maxPagesToDisplay >= this.amountOfPages;
  }

  @computedFrom('maxPagesToDisplay', 'pageStartValue', 'amountOfPages')
  public get amountOfPagesToDisplay(): number {
    if (this.showLimitedAmountOfPages) {
      if (this.lastPagesGetDisplayed && this.pageStartValue + this.maxPagesToDisplay > this.amountOfPages) {
        // WARUM +1???
        return this.maxPagesToDisplay - (this.pageStartValue + this.maxPagesToDisplay - this.amountOfPages) + 1;
      }

      return this.maxPagesToDisplay;
    }

    return this.amountOfPages;
  }

  public get currentPageIsLastPage(): boolean {
    return this.currentPage === this.amountOfPages;
  }

  public get currentPageIsFirstPage(): boolean {
    return this.currentPage === 1;
  }

  public showPreviousPage(): void {
    if (this.currentPageIsFirstPage) {
      return;
    }

    this.currentPage--;
  }

  public showNextPage(): void {
    if (this.currentPageIsLastPage) {
      return;
    }

    this.currentPage++;
  }

  public showFirstPage(): void {
    this.currentPage = 1;
    this.pageStartValue = 1;
  }

  public showLastPage(): void {
    this.currentPage = this.amountOfPages;
    this.pageStartValue = this.amountOfPages - this.maxPagesToDisplay;
  }

  public showPagesBeforeCurrentLimit(): void {
    this.pageStartValue -= this.maxPagesToDisplay;
    this.currentPage = this.pageStartValue * this.maxPagesToDisplay;
  }

  public showPagesAfterCurrentLimit(): void {
    this.pageStartValue += this.maxPagesToDisplay;
    this.currentPage = this.pageStartValue;
  }
}
