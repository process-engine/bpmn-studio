import {bindable, inject} from 'aurelia-framework';

import {DataModels} from '@process-engine/management_api_contracts';

import {ILogSortSettings, ISolutionEntry, LogSortProperty} from '../../../../../../../contracts/index';
import {getBeautifiedDate} from '../../../../../../../services/date-service/date.service';
import {IInspectProcessInstanceService} from '../../../../contracts';

@inject('InspectProcessInstanceService')
export class LogViewer {
  @bindable public log: Array<DataModels.Logging.LogEntry>;
  @bindable public processInstance: DataModels.Correlations.ProcessInstance;
  @bindable public activeSolutionEntry: ISolutionEntry;
  public logSortProperty: typeof LogSortProperty = LogSortProperty;
  public sortedLog: Array<DataModels.Logging.LogEntry>;
  public sortSettings: ILogSortSettings = {
    ascending: false,
    sortProperty: LogSortProperty.Time,
  };

  public showLogEntryModal: boolean = false;
  public logEntryForModal: DataModels.Logging.LogEntry;

  private inspectProcessInstanceService: IInspectProcessInstanceService;

  constructor(inspectProcessInstanceService: IInspectProcessInstanceService) {
    this.inspectProcessInstanceService = inspectProcessInstanceService;
  }

  public openLogEntryModal(logEntry: DataModels.Logging.LogEntry): void {
    this.logEntryForModal = logEntry;
    this.showLogEntryModal = true;
  }

  public getStringifiedObject(object: any): string {
    return JSON.stringify(object, null, 2);
  }

  public async processInstanceChanged(): Promise<void> {
    const noProcessInstanceSet: boolean = this.processInstance === undefined;
    if (noProcessInstanceSet) {
      return;
    }

    setTimeout(async () => {
      const logList = await this.inspectProcessInstanceService.getLogsForProcessInstance(
        this.processInstance.processModelId,
        this.processInstance.processInstanceId,
        this.activeSolutionEntry.identity,
      );

      this.log = logList.logEntries;

      this.sortLogs();
    }, 0);
  }

  public getDateStringFromTimestamp(timestamp: string): string {
    const dateString: string = getBeautifiedDate(timestamp);

    return dateString;
  }

  public changeSortProperty(property: LogSortProperty): void {
    const isSamePropertyAsPrevious: boolean = this.sortSettings.sortProperty === property;
    const ascending: boolean = isSamePropertyAsPrevious ? !this.sortSettings.ascending : true;

    this.sortSettings.ascending = ascending;
    this.sortSettings.sortProperty = property;

    this.sortLogs();
  }

  private sortLogs(): void {
    const sortPropertyIsTime: boolean = this.sortSettings.sortProperty === LogSortProperty.Time;

    const sortedLog: Array<DataModels.Logging.LogEntry> = sortPropertyIsTime
      ? this.getSortedLogByDate()
      : this.getSortedLogByProperty(this.sortSettings.sortProperty);

    this.sortedLog = this.sortSettings.ascending ? sortedLog : sortedLog.reverse();
  }

  private getSortedLogByProperty(property: LogSortProperty): Array<DataModels.Logging.LogEntry> {
    const sortedLog: Array<DataModels.Logging.LogEntry> = this.log.sort(
      (firstEntry: DataModels.Logging.LogEntry, secondEntry: DataModels.Logging.LogEntry) => {
        // FlowNodeId and FlowNodeInstanceId can be 'undefined', if the LogEntry is for a ProcessInstance.
        // Using 'greaterThan' in conjunction with 'undefined' will always be "false", which will mess up the sorting.
        // So these cases must be handled separately.
        const firstFieldIsUndefined: boolean = !firstEntry[property];
        if (firstFieldIsUndefined) {
          return -1;
        }

        const secondFieldIsUndefined: boolean = !secondEntry[property];
        if (secondFieldIsUndefined) {
          return 1;
        }

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

    return sortedLog;
  }

  private getSortedLogByDate(): Array<DataModels.Logging.LogEntry> {
    const sortedLog: Array<DataModels.Logging.LogEntry> = this.log.sort(
      (firstEntry: DataModels.Logging.LogEntry, secondEntry: DataModels.Logging.LogEntry) => {
        const firstCorrelationDate: Date = new Date(firstEntry.timeStamp);
        const secondCorrelationDate: Date = new Date(secondEntry.timeStamp);

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

    return sortedLog;
  }
}
