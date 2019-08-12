import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';

import {DataModels} from '@process-engine/management_api_contracts';

import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {
  CorrelationListSortProperty,
  ICorrelationSortSettings,
  ICorrelationTableEntry,
} from '../../../../../../../contracts/index';
import environment from '../../../../../../../environment';
import {getBeautifiedDate} from '../../../../../../../services/date-service/date.service';
import {IProcessInstanceWithCorrelation} from '../../../../contracts/index';

@inject(EventAggregator)
export class CorrelationList {
  @bindable public processInstanceToSelect: string;
  @bindable public selectedProcessInstance: DataModels.Correlations.CorrelationProcessInstance;
  @bindable public selectedCorrelation: DataModels.Correlations.Correlation;
  @bindable public correlations: Array<DataModels.Correlations.Correlation>;
  @bindable public processInstances: Array<DataModels.Correlations.CorrelationProcessInstance>;
  @bindable public activeDiagram: IDiagram;
  public sortedTableData: Array<ICorrelationTableEntry>;
  public correlationListSortProperty: typeof CorrelationListSortProperty = CorrelationListSortProperty;
  public sortSettings: ICorrelationSortSettings = {
    ascending: false,
    sortProperty: undefined,
  };

  public processInstancesWithCorrelation: Array<IProcessInstanceWithCorrelation> = [];
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
    this.selectedProcessInstance = this.getProcessModelForTableEntry(selectedTableEntry);
    this.selectedCorrelation = this.getCorrelationForTableEntry(selectedTableEntry);
    this.selectedTableEntry = selectedTableEntry;
  }

  public correlationsChanged(): void {
    this.processInstancesWithCorrelation = [];
    this.processInstances = [];

    this.correlations.forEach((correlation: DataModels.Correlations.Correlation) => {
      correlation.processInstances.forEach((processInstance: DataModels.Correlations.CorrelationProcessInstance) => {
        const isNotSelectedProcessModel: boolean = processInstance.processModelId !== this.activeDiagram.id;

        if (isNotSelectedProcessModel) {
          return;
        }

        const processInstanceWithCorrelation: IProcessInstanceWithCorrelation = {
          processInstance: processInstance,
          correlation: correlation,
        };

        this.processInstancesWithCorrelation.push(processInstanceWithCorrelation);
        this.processInstances.push(processInstance);
      });
    });

    this.convertCorrelationsIntoTableData();

    // Select latest process instance
    const sortedTableData: Array<ICorrelationTableEntry> = this.sortListByStartDate();
    const tableDataIsExisiting: boolean = sortedTableData.length > 0;

    if (tableDataIsExisiting) {
      const latestCorelationTableEntry: ICorrelationTableEntry = sortedTableData[sortedTableData.length - 1];

      this.selectCorrelation(latestCorelationTableEntry);
    }

    const sortSettingsExisitng: boolean = this.sortSettings.sortProperty !== undefined;
    if (sortSettingsExisitng) {
      this.sortSettings.ascending = !this.sortSettings.ascending;

      this.sortList(this.sortSettings.sortProperty);
    } else {
      this.sortSettings.sortProperty = CorrelationListSortProperty.Number;
      this.sortSettings.ascending = true;

      this.sortList(CorrelationListSortProperty.Number);
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

  private convertCorrelationsIntoTableData(): void {
    this.tableData = this.processInstancesWithCorrelation.map(
      (processInstanceWithCorrelation: IProcessInstanceWithCorrelation) => {
        const correlation: DataModels.Correlations.Correlation = processInstanceWithCorrelation.correlation;
        const processInstance: DataModels.Correlations.CorrelationProcessInstance =
          processInstanceWithCorrelation.processInstance;

        const formattedStartedDate: string = getBeautifiedDate(processInstanceWithCorrelation.correlation.createdAt);

        const index: number = this.getIndexForProcessInstance(processInstance);
        const state: string = correlation.state.toUpperCase();

        const tableEntry: ICorrelationTableEntry = {
          index: index,
          startedAt: formattedStartedDate,
          state: state,
          user: 'Not supported yet.',
          correlationId: correlation.id,
          processInstanceId: processInstance.processInstanceId,
        };

        return tableEntry;
      },
    );
  }

  public sortList(property: CorrelationListSortProperty): void {
    this.sortedTableData = [];

    const isSameSortPropertyAsBefore: boolean = this.sortSettings.sortProperty === property;
    const ascending: boolean = isSameSortPropertyAsBefore ? !this.sortSettings.ascending : true;

    this.sortSettings.ascending = ascending;
    this.sortSettings.sortProperty = property;

    const sortByDate: boolean = property === CorrelationListSortProperty.StartedAt;

    const sortedTableData: Array<ICorrelationTableEntry> = sortByDate
      ? this.sortListByStartDate()
      : this.sortListByProperty(property);

    this.sortedTableData = ascending ? sortedTableData : sortedTableData.reverse();
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
        const firstCorrelation: DataModels.Correlations.Correlation = this.getCorrelationForTableEntry(firstEntry);
        const secondCorrelation: DataModels.Correlations.Correlation = this.getCorrelationForTableEntry(secondEntry);

        const firstCorrelationDate: Date = new Date(firstCorrelation.createdAt);
        const secondCorrelationDate: Date = new Date(secondCorrelation.createdAt);

        const firstEntryIsBigger: boolean = firstCorrelationDate.getTime() > secondCorrelationDate.getTime();
        if (firstEntryIsBigger) {
          return 1;
        }

        const secondEntryIsBigger: boolean = firstCorrelationDate.getTime() < secondCorrelationDate.getTime();
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

    return correlationForTableEntry;
  }

  private getProcessModelForTableEntry(
    tableEntry: ICorrelationTableEntry,
  ): DataModels.Correlations.CorrelationProcessInstance {
    const correlationForTableEntry: DataModels.Correlations.Correlation = this.correlations.find(
      (correlation: DataModels.Correlations.Correlation) => {
        return correlation.id === tableEntry.correlationId;
      },
    );

    const processModelForTableEntry: DataModels.Correlations.CorrelationProcessInstance = correlationForTableEntry.processInstances.find(
      (processModel: DataModels.Correlations.CorrelationProcessInstance) => {
        return processModel.processInstanceId === tableEntry.processInstanceId;
      },
    );

    return processModelForTableEntry;
  }

  private getIndexForProcessInstance(processInstance: DataModels.Correlations.CorrelationProcessInstance): number {
    const processInstanceStartTime: Date = new Date(processInstance.createdAt);

    const earlierStartedProcessInstances: Array<
      IProcessInstanceWithCorrelation
    > = this.processInstancesWithCorrelation.filter(
      (processInstanceWithCorrelation: IProcessInstanceWithCorrelation) => {
        const processInstanceEntry: DataModels.Correlations.CorrelationProcessInstance =
          processInstanceWithCorrelation.processInstance;
        const entryStartedDate: Date = new Date(processInstanceEntry.createdAt);

        return entryStartedDate.getTime() < processInstanceStartTime.getTime();
      },
    );

    const amountOfEarlierStartedProcessInstances: number = earlierStartedProcessInstances.length;
    const index: number = amountOfEarlierStartedProcessInstances + 1;

    return index;
  }
}
