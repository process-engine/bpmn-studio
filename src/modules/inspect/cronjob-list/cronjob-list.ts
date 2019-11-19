import {bindable, computedFrom, inject, observable} from 'aurelia-framework';
import {Subscription} from 'aurelia-event-aggregator';

import * as Bluebird from 'bluebird';

import {DataModels} from '@process-engine/management_api_contracts';
import {ForbiddenError, UnauthorizedError, isError} from '@essential-projects/errors_ts';
import {IIdentity} from '@essential-projects/iam_contracts';
import {Subscription as RuntimeSubscription} from '@essential-projects/event_aggregator_contracts';

import {AuthenticationStateEvent, ISolutionEntry, ISolutionService} from '../../../contracts/index';
import environment from '../../../environment';
import {getBeautifiedDate} from '../../../services/date-service/date.service';
import {IDashboardService} from '../dashboard/contracts';
import {processEngineSupportsCronjobEvents} from '../../../services/process-engine-version-module/process-engine-version.module';
import {Pagination} from '../../pagination/pagination';
import {solutionIsRemoteSolution} from '../../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';

@inject('DashboardService', 'SolutionService')
export class CronjobList {
  @bindable public activeSolutionEntry: ISolutionEntry;
  public initialLoadingFinished: boolean = false;
  @observable public currentPage: number = 1;
  public pageSize: number = 10;
  public paginationSize: number = 10;
  public totalItems: number;
  public showError: boolean;
  public paginationShowsLoading: boolean;

  public pagination: Pagination;

  private subscriptions: Array<Subscription>;
  private dashboardServiceSubscriptions: Array<RuntimeSubscription> = [];
  private cronjobsToDisplay: Array<DataModels.Cronjobs.CronjobConfiguration> = [];
  private pollingTimeout: NodeJS.Timeout;
  private isAttached: boolean;
  private dashboardService: IDashboardService;
  private identitiyUsedForSubscriptions: IIdentity;
  private solutionService: ISolutionService;

  private solutionEventListenerId: string;

  private updatePromise: any;

  constructor(dashboardService: IDashboardService, solutionService: ISolutionService) {
    this.dashboardService = dashboardService;
    this.solutionService = solutionService;
  }

  public async activeSolutionEntryChanged(
    newSolutionEntry: ISolutionEntry,
    previousActiveSolutionEntry: ISolutionEntry,
  ): Promise<void> {
    if (!newSolutionEntry.uri.includes('http')) {
      return;
    }

    if (!this.isAttached) {
      return;
    }

    if (this.updatePromise) {
      this.updatePromise.cancel();
    }

    this.removeRuntimeSubscriptions();

    if (processEngineSupportsCronjobEvents(this.activeSolutionEntry.processEngineVersion)) {
      clearTimeout(this.pollingTimeout);

      this.setRuntimeSubscriptions();
    } else {
      this.startPolling();
    }

    if (this.solutionEventListenerId !== undefined) {
      previousActiveSolutionEntry.service.unwatchSolution(this.solutionEventListenerId);
    }

    this.solutionEventListenerId = this.activeSolutionEntry.service.watchSolution(() => {
      this.updateCronjobs();
    });

    this.cronjobsToDisplay = [];
    this.initialLoadingFinished = false;
    this.showError = false;
    this.dashboardService.eventAggregator.publish(
      environment.events.configPanel.solutionEntryChanged,
      newSolutionEntry,
    );

    await this.updateCronjobs();
  }

  public async attached(): Promise<void> {
    this.isAttached = true;

    const activeSolutionUriIsNotSet: boolean =
      this.activeSolutionEntry === undefined || this.activeSolutionEntry.uri === undefined;
    const activeSolutionUriIsNotRemote: boolean = !solutionIsRemoteSolution(this.activeSolutionEntry.uri);

    if (activeSolutionUriIsNotSet || activeSolutionUriIsNotRemote) {
      const activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');

      this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(activeSolutionUri);
    }

    await this.updateCronjobs();

    if (processEngineSupportsCronjobEvents(this.activeSolutionEntry.processEngineVersion)) {
      const subscriptionNeedsToBeSet: boolean = this.dashboardServiceSubscriptions.length === 0;
      if (subscriptionNeedsToBeSet) {
        this.setRuntimeSubscriptions();
      }
    } else {
      this.startPolling();
    }

    this.subscriptions = [
      this.dashboardService.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, async () => {
        const needsToRenewSubscriptions: boolean = processEngineSupportsCronjobEvents(
          this.activeSolutionEntry.processEngineVersion,
        );
        if (needsToRenewSubscriptions) {
          this.removeRuntimeSubscriptions();
        }

        await this.updateCronjobs();

        if (needsToRenewSubscriptions) {
          this.setRuntimeSubscriptions();
        }
      }),
    ];

    if (this.solutionEventListenerId === undefined) {
      this.solutionEventListenerId = this.activeSolutionEntry.service.watchSolution(() => {
        this.updateCronjobs();
      });
    }
  }

  public async detached(): Promise<void> {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }

    this.isAttached = false;
    this.stopPolling();

    if (this.solutionEventListenerId !== undefined) {
      this.activeSolutionEntry.service.unwatchSolution(this.solutionEventListenerId);
    }

    this.removeRuntimeSubscriptions();
  }

  public currentPageChanged(newValue, oldValue): void {
    const paginationIsInitialized: boolean = oldValue === undefined;
    if (!this.isAttached || paginationIsInitialized) {
      return;
    }

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

      this.paginationShowsLoading = false;
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
        const paginationGetsDisplayed: boolean = this.totalItems > this.pageSize;
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

  private stopPolling(): void {
    clearTimeout(this.pollingTimeout);
  }

  private sortCronjobs(
    firstCronjob: DataModels.Cronjobs.CronjobConfiguration,
    secondCronjob: DataModels.Cronjobs.CronjobConfiguration,
  ): number {
    return firstCronjob.nextExecution.getTime() - secondCronjob.nextExecution.getTime();
  }

  private startPolling(): void {
    this.pollingTimeout = setTimeout(async () => {
      await this.updateCronjobs();

      if (this.isAttached) {
        this.startPolling();
      }
    }, environment.processengine.dashboardPollingIntervalInMs);
  }

  private async setRuntimeSubscriptions(): Promise<void> {
    const subscriptionsExist: boolean = this.dashboardServiceSubscriptions.length > 0;
    if (subscriptionsExist) {
      this.removeRuntimeSubscriptions();
    }

    this.identitiyUsedForSubscriptions = this.activeSolutionEntry.identity;

    this.dashboardServiceSubscriptions = [
      await this.dashboardService.onCronjobCreated(this.activeSolutionEntry.identity, async (message) => {
        await this.updateCronjobs();
      }),

      await this.dashboardService.onCronjobExecuted(this.activeSolutionEntry.identity, async (message) => {
        await this.updateCronjobs();
      }),

      await this.dashboardService.onCronjobStopped(this.activeSolutionEntry.identity, async (message) => {
        await this.updateCronjobs();
      }),

      await this.dashboardService.onCronjobUpdated(this.activeSolutionEntry.identity, async (message) => {
        await this.updateCronjobs();
      }),

      await this.dashboardService.onCronjobRemoved(this.activeSolutionEntry.identity, async (message) => {
        await this.updateCronjobs();
      }),
    ];
  }

  private removeRuntimeSubscriptions(): void {
    for (const subscription of this.dashboardServiceSubscriptions) {
      this.dashboardService.removeSubscription(this.identitiyUsedForSubscriptions, subscription);
    }

    this.dashboardServiceSubscriptions = [];
  }
}
