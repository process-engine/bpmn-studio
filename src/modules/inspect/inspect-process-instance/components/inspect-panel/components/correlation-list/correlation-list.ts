import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, computedFrom, inject, observable} from 'aurelia-framework';

import {DataModels} from '@process-engine/management_api_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {
  CorrelationListSortProperty,
  ICorrelationSortSettings,
  ICorrelationTableEntry,
} from '../../../../../../../contracts/index';
import environment from '../../../../../../../environment';
import {getBeautifiedDate} from '../../../../../../../services/date-service/date.service';
import {Pagination} from '../../../../../../pagination/pagination';

const PAGE_SIZES = [20, 50, 100, 200];
const MIN_PAGESIZE = PAGE_SIZES[0];
export const DEFAULT_PAGESIZE = PAGE_SIZES[1];

const PAGINATION_SIZE = 10;

@inject(EventAggregator)
export class CorrelationList {
  @bindable public correlationToSelect: DataModels.Correlations.Correlation;
  @bindable public correlationToSelectTableEntry: ICorrelationTableEntry;
  @bindable public selectedCorrelation: DataModels.Correlations.Correlation;
  @bindable @observable public correlations: Array<DataModels.Correlations.Correlation>;
  @bindable public activeDiagram: IDiagram;
  @bindable public sortedTableData: Array<ICorrelationTableEntry>;
  @bindable public paginationShowsLoading: boolean;
  @bindable public selectedTableEntry: ICorrelationTableEntry;

  public pagination: Pagination;

  @bindable public totalCount: number;
  @bindable public currentPage: number = 1;
  @observable public pageSize: number = DEFAULT_PAGESIZE;
  public minPageSize: number = MIN_PAGESIZE;
  public paginationSize: number = PAGINATION_SIZE;
  public pageSizes: Array<number> = PAGE_SIZES;

  public correlationListSortProperty: typeof CorrelationListSortProperty = CorrelationListSortProperty;
  public sortSettings: ICorrelationSortSettings = {
    ascending: false,
    sortProperty: CorrelationListSortProperty.StartedAt,
  };

  private tableData: Array<ICorrelationTableEntry> = [];
  private eventAggregator: EventAggregator;

  constructor(eventAggregator: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public showProcessInstanceList(): void {
    this.eventAggregator.publish(environment.events.inspectProcessInstance.showProcessInstanceList);
  }

  public selectCorrelation(selectedTableEntry: ICorrelationTableEntry): void {
    this.selectedCorrelation = this.getCorrelationForTableEntry(selectedTableEntry);
    this.selectedTableEntry = selectedTableEntry;
  }

  public activeDiagramChanged(): void {
    this.currentPage = 1;
    this.correlationToSelect = undefined;
    this.correlationToSelectTableEntry = undefined;
  }

  public correlationToSelectChanged(): void {
    if (this.correlationToSelect === undefined || this.sortedTableData === undefined) {
      return;
    }

    this.selectCorrelationToSelect();
  }

  public correlationsChanged(): void {
    if (!this.activeDiagram) {
      return;
    }

    this.tableData = this.convertCorrelationsIntoTableData(this.correlations);
    this.sortTableData();

    const tableDataIsExisiting: boolean = this.sortedTableData.length > 0;
    if (tableDataIsExisiting && this.correlationToSelect) {
      this.selectCorrelationToSelect();
    } else if (tableDataIsExisiting) {
      const firstTableEntry: ICorrelationTableEntry = this.sortedTableData[0];

      this.selectCorrelation(firstTableEntry);
    }

    this.paginationShowsLoading = false;
  }

  public pageSizeChanged(newValue, oldValue): void {
    const isNotInitializedYet = oldValue === undefined;
    if (isNotInitializedYet) {
      return;
    }

    const showAllProcessInstances: boolean = this.pageSize === 0;
    if (showAllProcessInstances) {
      this.currentPage = 1;
    } else {
      this.sortSettings.ascending = false;
      this.sortSettings.sortProperty = CorrelationListSortProperty.StartedAt;
      this.sortTableData();
    }

    const isFirstPage: boolean = this.currentPage === 1;
    if (isFirstPage) {
      const payload = {
        offset: 0,
        limit: this.pageSize,
      };
      this.eventAggregator.publish(environment.events.inspectProcessInstance.updateCorrelations, payload);

      return;
    }

    const currentOffset: number = (this.currentPage - 1) * oldValue;

    this.currentPage = Math.floor(currentOffset / this.pageSize) + 1;
  }

  public currentPageChanged(newValue: number, oldValue: number): void {
    const isNotInitializedYet = oldValue === undefined;
    if (isNotInitializedYet) {
      return;
    }

    const payload = {
      offset: this.currentPage === 1 || this.currentPage === 0 ? 0 : (this.currentPage - 1) * this.pageSize,
      limit: this.pageSize,
    };

    this.eventAggregator.publish(environment.events.inspectProcessInstance.updateCorrelations, payload);
  }

  @computedFrom('pageSize', 'totalCount')
  public get showSortOption(): boolean {
    return this.pageSize == 0 || this.totalCount < this.minPageSize;
  }

  private convertCorrelationsIntoTableData(
    correlations: Array<DataModels.Correlations.Correlation>,
  ): Array<ICorrelationTableEntry> {
    return correlations.map(this.convertCorrelationIntoTableData);
  }

  private convertCorrelationIntoTableData(correlation: DataModels.Correlations.Correlation): ICorrelationTableEntry {
    const tableEntry: ICorrelationTableEntry = {
      startedAt: getBeautifiedDate(correlation.createdAt),
      state: correlation.state,
      correlationId: correlation.id,
    };

    return tableEntry;
  }

  public changeSortSettings(property: CorrelationListSortProperty): void {
    if (!this.showSortOption) {
      return;
    }

    const isSameSortPropertyAsBefore: boolean = this.sortSettings.sortProperty === property;
    const ascending: boolean = isSameSortPropertyAsBefore ? !this.sortSettings.ascending : true;

    this.sortSettings.ascending = ascending;
    this.sortSettings.sortProperty = property;

    this.sortTableData();
  }

  private selectCorrelationToSelect(): void {
    const correlationFromTableData: ICorrelationTableEntry = this.sortedTableData.find(
      (correlation: ICorrelationTableEntry) => {
        return correlation.correlationId === this.correlationToSelect.id;
      },
    );

    this.correlationToSelectTableEntry =
      correlationFromTableData || this.convertCorrelationIntoTableData(this.correlationToSelect);

    this.selectCorrelation(this.correlationToSelectTableEntry);
  }

  private sortTableData(): void {
    const sortByDate: boolean = this.sortSettings.sortProperty === CorrelationListSortProperty.StartedAt;

    const sortedTableData: Array<ICorrelationTableEntry> = sortByDate
      ? this.sortTableDataByStartDate()
      : this.sortTableDataByProperty(this.sortSettings.sortProperty);

    this.sortedTableData = this.sortSettings.ascending ? sortedTableData : sortedTableData.reverse();
  }

  private sortTableDataByProperty(property: CorrelationListSortProperty): Array<ICorrelationTableEntry> {
    const copyOfTableData: Array<ICorrelationTableEntry> = this.tableData.slice();

    const sortedTableData: Array<ICorrelationTableEntry> = copyOfTableData.sort(
      (firstEntry: ICorrelationTableEntry, secondEntry: ICorrelationTableEntry) => {
        const firstEntryIsBigger: boolean = firstEntry[property] > secondEntry[property];
        if (firstEntryIsBigger) {
          return 1;
        }

        const secondEntryIsBigger: boolean = firstEntry[property] < secondEntry[property];
        if (secondEntryIsBigger) {
          return -1;
        }

        return 0;
      },
    );

    return sortedTableData;
  }

  private sortTableDataByStartDate(): Array<ICorrelationTableEntry> {
    const copyOfTableData: Array<ICorrelationTableEntry> = this.tableData.slice();

    const sortedTableData: Array<ICorrelationTableEntry> = copyOfTableData.sort(
      (firstEntry: ICorrelationTableEntry, secondEntry: ICorrelationTableEntry) => {
        const firstProcessInstanceDate: Date = new Date(firstEntry.startedAt);
        const secondProcessInstanceDate: Date = new Date(secondEntry.startedAt);

        const firstEntryIsBigger: boolean = firstProcessInstanceDate.getTime() > secondProcessInstanceDate.getTime();
        if (firstEntryIsBigger) {
          return 1;
        }

        const secondEntryIsBigger: boolean = firstProcessInstanceDate.getTime() < secondProcessInstanceDate.getTime();
        if (secondEntryIsBigger) {
          return -1;
        }

        return 0;
      },
    );

    return sortedTableData;
  }

  private getCorrelationForTableEntry(tableEntry: ICorrelationTableEntry): DataModels.Correlations.Correlation {
    const correlationForTableEntry: DataModels.Correlations.Correlation = this.correlations.find(
      (correlation: DataModels.Correlations.Correlation) => {
        return correlation.id === tableEntry.correlationId;
      },
    );

    return correlationForTableEntry || this.correlationToSelect;
  }
}
