import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, inject, observable} from 'aurelia-framework';

import {DataModels} from '@process-engine/management_api_contracts';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {
  CorrelationListSortProperty,
  ICorrelationSortSettings,
  ICorrelationTableEntry,
} from '../../../../../../../contracts/index';
import environment from '../../../../../../../environment';
import {getBeautifiedDate} from '../../../../../../../services/date-service/date.service';

@inject(EventAggregator)
export class CorrelationList {
  @bindable public processInstanceToSelect: string;
  @bindable public selectedProcessInstance: DataModels.Correlations.ProcessInstance;
  @bindable @observable public correlations: Array<DataModels.Correlations.ProcessInstance>;
  @bindable public activeDiagram: IDiagram;
  @bindable public sortedTableData: Array<ICorrelationTableEntry>;
  @bindable public totalCount: number;
  @bindable public currentPage: number = 0;
  @observable public pageSize: number = 50;
  public paginationSize: number = 10;

  public pageSizes: Array<number> = [20, 50, 100, 200];
  public correlationListSortProperty: typeof CorrelationListSortProperty = CorrelationListSortProperty;
  public sortSettings: ICorrelationSortSettings = {
    ascending: false,
    sortProperty: undefined,
  };

  public selectedTableEntry: ICorrelationTableEntry;

  private tableData: Array<ICorrelationTableEntry> = [];
  private eventAggregator: EventAggregator;

  constructor(eventAggregator: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public showLogViewer(): void {
    this.eventAggregator.publish(environment.events.inspectCorrelation.showLogViewer);
  }

  public selectCorrelation(selectedTableEntry: ICorrelationTableEntry): void {
    this.selectedProcessInstance = this.getProcessInstanceForTableEntry(selectedTableEntry);
    this.selectedTableEntry = selectedTableEntry;
  }

  public activeDiagramChanged(): void {
    this.currentPage = 0;
  }

  public correlationsChanged(): void {
    const lastItem = this.pageSizes[this.pageSizes.length - 1];
    if (lastItem !== 200) {
      this.pageSizes.splice(-1, 1, this.totalCount);
    } else {
      this.pageSizes.push(this.totalCount);
    }

    if (!this.activeDiagram) {
      return;
    }

    this.tableData = this.convertProcessInstancesIntoTableData(this.correlations);

    const tableDataIsExisiting: boolean = this.tableData.length > 0;

    if (tableDataIsExisiting) {
      const latestCorelationTableEntry: ICorrelationTableEntry = this.tableData[this.tableData.length - 1];

      this.selectCorrelation(latestCorelationTableEntry);
    }

    const sortSettingsExisitng: boolean = this.sortSettings.sortProperty !== undefined;
    if (sortSettingsExisitng) {
      this.sortSettings.ascending = !this.sortSettings.ascending;

      this.sortedTableData = this.sortList(this.sortSettings.sortProperty);
    } else {
      this.sortedTableData = this.tableData.reverse();
    }

    const processInstanceToSelectExists: boolean = this.processInstanceToSelect !== undefined;
    if (processInstanceToSelectExists) {
      const entryToSelect: ICorrelationTableEntry = this.sortedTableData.find((entry: ICorrelationTableEntry) => {
        return entry.processInstanceId === this.processInstanceToSelect;
      });

      this.selectCorrelation(entryToSelect);

      this.processInstanceToSelect = undefined;
    }
  }

  public pageSizeChanged(newValue, oldValue): void {
    if (oldValue === undefined) {
      return;
    }

    if (newValue < oldValue) {
      this.sortedTableData = this.sortedTableData.slice(0, newValue);
      return;
    }

    const payload = {
      pageSize: this.pageSize,
      currentPage: this.currentPage,
    };

    this.eventAggregator.publish(environment.events.inspectCorrelation.updateProcessInstances, payload);
  }

  public currentPageChanged(newValue: number, oldValue: number): void {
    const oldValueIsDefined: boolean = oldValue !== undefined && oldValue !== null;

    if (oldValueIsDefined) {
      const payload = {
        pageSize: this.pageSize,
        currentPage: this.currentPage,
      };

      this.eventAggregator.publish(environment.events.inspectCorrelation.updateProcessInstances, payload);
    }
  }

  private convertProcessInstancesIntoTableData(
    processInstances: Array<DataModels.Correlations.ProcessInstance>,
  ): Array<ICorrelationTableEntry> {
    return processInstances.map((processInstance: DataModels.Correlations.ProcessInstance) => {
      const formattedStartedDate: string = getBeautifiedDate(processInstance.createdAt);

      const tableEntry: ICorrelationTableEntry = {
        startedAt: formattedStartedDate,
        state: processInstance.state,
        user: 'Not supported yet.',
        correlationId: processInstance.correlationId,
        processInstanceId: processInstance.processInstanceId,
      };

      return tableEntry;
    });
  }

  public sortList(property: CorrelationListSortProperty): Array<ICorrelationTableEntry> {
    const isSameSortPropertyAsBefore: boolean = this.sortSettings.sortProperty === property;
    const ascending: boolean = isSameSortPropertyAsBefore ? !this.sortSettings.ascending : true;

    this.sortSettings.ascending = ascending;
    this.sortSettings.sortProperty = property;

    const sortByDate: boolean = property === CorrelationListSortProperty.StartedAt;

    const sortedTableData: Array<ICorrelationTableEntry> = sortByDate
      ? this.sortListByStartDate()
      : this.sortListByProperty(property);

    return ascending ? sortedTableData : sortedTableData.reverse();
  }

  private sortListByProperty(property: CorrelationListSortProperty): Array<ICorrelationTableEntry> {
    const sortedTableData: Array<ICorrelationTableEntry> = this.tableData.sort(
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

  private sortListByStartDate(): Array<ICorrelationTableEntry> {
    const sortedTableData: Array<ICorrelationTableEntry> = this.tableData.sort(
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

  private getProcessInstanceForTableEntry(tableEntry: ICorrelationTableEntry): DataModels.Correlations.ProcessInstance {
    const processInstanceForTableEntry: DataModels.Correlations.ProcessInstance = this.correlations.find(
      (processInstance: DataModels.Correlations.ProcessInstance) => {
        return processInstance.processInstanceId === tableEntry.processInstanceId;
      },
    );

    return processInstanceForTableEntry;
  }
}
