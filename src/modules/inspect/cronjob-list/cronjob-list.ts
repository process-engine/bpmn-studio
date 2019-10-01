import {bindable, computedFrom, inject, observable} from 'aurelia-framework';

import * as Bluebird from 'bluebird';

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

  private cronjobsToDisplay: Array<DataModels.Cronjobs.CronjobConfiguration> = [];
  private pollingTimeout: NodeJS.Timeout;
  private isAttached: boolean;
  private dashboardService: IDashboardService;

  private updatePromise: any;

  constructor(dashboardService: IDashboardService) {
    this.dashboardService = dashboardService;
  }

  public async activeSolutionEntryChanged(newSolutionEntry: ISolutionEntry): Promise<void> {
    if (!this.isAttached) {
      return;
    }

    if (this.updatePromise) {
      this.updatePromise.cancel();
    }

    this.cronjobsToDisplay = [];
    this.initialLoadingFinished = false;
    this.showError = false;
    this.dashboardService.eventAggregator.publish(
      environment.events.configPanel.solutionEntryChanged,
      newSolutionEntry,
    );
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
    if (this.updatePromise) {
      this.updatePromise.cancel();
    }

    this.updateCronjobs();
  }

  @computedFrom('cronjobsToDisplay.length')
  public get showCronjobList(): boolean {
    return this.cronjobsToDisplay !== undefined && this.cronjobsToDisplay.length > 0;
  }

  public getBeautifiedDate(date: Date): string {
    const beautifiedDate: string = getBeautifiedDate(date);

    return beautifiedDate;
  }

  private async updateCronjobs(): Promise<void> {
    try {
      this.updatePromise = this.getCronjobList();

      const cronjobList = await this.updatePromise;

      this.cronjobsToDisplay = cronjobList.cronjobs.sort(this.sortCronjobs);
      this.totalItems = cronjobList.totalCount;
      this.initialLoadingFinished = true;
    } catch (error) {
      this.initialLoadingFinished = true;

      const errorIsForbiddenError: boolean = isError(error, ForbiddenError);
      const errorIsUnauthorizedError: boolean = isError(error, UnauthorizedError);
      const errorIsAuthenticationRelated: boolean = errorIsForbiddenError || errorIsUnauthorizedError;

      if (!errorIsAuthenticationRelated) {
        this.cronjobsToDisplay = [];
        this.totalItems = 0;
        this.showError = true;
      }
    }
  }

  private getCronjobList(): Promise<DataModels.Cronjobs.CronjobList> {
    return new Bluebird.Promise(
      async (resolve: Function, reject: Function): Promise<void> => {
        const paginationGetsDisplayed: boolean = this.currentPage > 0;
        const pageIndex: number = paginationGetsDisplayed ? this.currentPage - 1 : 0;

        const cronjobOffset: number = pageIndex * this.pageSize;

        try {
          const cronjobList = await this.dashboardService.getAllActiveCronjobs(
            this.activeSolutionEntry.identity,
            cronjobOffset,
            this.pageSize,
          );

          resolve(cronjobList);
        } catch (error) {
          reject(error);
        }
      },
    );
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
