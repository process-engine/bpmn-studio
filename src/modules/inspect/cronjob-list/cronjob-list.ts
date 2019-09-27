import {bindable, computedFrom, inject, observable} from 'aurelia-framework';

import {DataModels} from '@process-engine/management_api_contracts';

import {ForbiddenError, UnauthorizedError, isError} from '@essential-projects/errors_ts';
import {ISolutionEntry} from '../../../contracts/index';
import environment from '../../../environment';
import {getBeautifiedDate} from '../../../services/date-service/date.service';
import {IDashboardService} from '../dashboard/contracts';

@inject('DashboardService')
export class CronjobList {
  @bindable public activeSolutionEntry: ISolutionEntry;
  public initialLoadingFinished: boolean = false;
  @observable public currentPage: number = 0;
  public pageSize: number = 10;
  public paginationSize: number = 10;
  public totalItems: number;
  public showError: boolean;

  private cronjobs: Array<DataModels.Cronjobs.CronjobConfiguration> = [];
  private pollingTimeout: NodeJS.Timeout;
  private isAttached: boolean;
  private dashboardService: IDashboardService;

  constructor(dashboardService: IDashboardService) {
    this.dashboardService = dashboardService;
  }

  public async activeSolutionEntryChanged(newSolutionEntry: ISolutionEntry): Promise<void> {
    if (this.isAttached) {
      this.cronjobs = [];
      this.initialLoadingFinished = false;
      this.showError = false;
      this.dashboardService.eventAggregator.publish(
        environment.events.configPanel.solutionEntryChanged,
        newSolutionEntry,
      );

      await this.updateCronjobs();
    }
  }

  public async attached(): Promise<void> {
    this.isAttached = true;

    await this.updateCronjobs();
    this.startPolling();
  }

  public detached(): void {
    this.isAttached = false;
    this.stopPolling();
  }

  public currentPageChanged(): void {
    this.updateCronjobs();
  }

  @computedFrom('cronjobs.length')
  public get showCronjobList(): boolean {
    return this.cronjobs !== undefined && this.cronjobs.length > 0;
  }

  public getBeautifiedDate(date: Date): string {
    const beautifiedDate: string = getBeautifiedDate(date);

    return beautifiedDate;
  }

  public async updateCronjobs(): Promise<void> {
    try {
      const pageIndex: number = Math.max(this.currentPage - 1, 0);
      const cronjobOffset: number = pageIndex * this.pageSize;

      const cronjobList = await this.dashboardService.getAllActiveCronjobs(
        this.activeSolutionEntry.identity,
        cronjobOffset,
        this.pageSize,
      );

      this.cronjobs = cronjobList.cronjobs;
      this.totalItems = cronjobList.totalCount;
      this.initialLoadingFinished = true;
    } catch (error) {
      this.initialLoadingFinished = true;

      const errorIsForbiddenError: boolean = isError(error, ForbiddenError);
      const errorIsUnauthorizedError: boolean = isError(error, UnauthorizedError);
      const errorIsAuthenticationRelated: boolean = errorIsForbiddenError || errorIsUnauthorizedError;

      if (!errorIsAuthenticationRelated) {
        this.cronjobs = [];
        this.totalItems = 0;
        this.showError = true;
      }
    }
  }

  private startPolling(): void {
    this.pollingTimeout = setTimeout(async () => {
      await this.updateCronjobs();

      if (this.isAttached) {
        this.startPolling();
      }
    }, environment.processengine.dashboardPollingIntervalInMs);
  }

  private stopPolling(): void {
    clearTimeout(this.pollingTimeout);
  }

  private sortCronjobs(
    firstCronjob: DataModels.Cronjobs.CronjobConfiguration,
    secondCronjob: DataModels.Cronjobs.CronjobConfiguration,
  ): number {
    return firstCronjob.nextExecution.getTime() - secondCronjob.nextExecution.getTime();
  }
}
