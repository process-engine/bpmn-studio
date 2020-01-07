import {Subscription} from 'aurelia-event-aggregator';
import {bindable, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';
import {Subscription as RuntimeSubscription} from '@essential-projects/event_aggregator_contracts';

import {ForbiddenError, UnauthorizedError, isError} from '@essential-projects/errors_ts';
import * as Bluebird from 'bluebird';

import {AuthenticationStateEvent, ISolutionEntry, ISolutionService, NotificationType} from '../../../contracts/index';
import {getBeautifiedDate} from '../../../services/date-service/date.service';
import {NotificationService} from '../../../services/notification-service/notification.service';
import environment from '../../../environment';
import {IDashboardService} from '../dashboard/contracts';
import {Pagination} from '../../pagination/pagination';
import {solutionIsRemoteSolution} from '../../../services/solution-is-remote-solution-module/solution-is-remote-solution.module';

@inject('DashboardService', 'NotificationService', 'SolutionService', Router)
export class ProcessList {
  @observable public currentPage: number = 1;
  @bindable() public activeSolutionEntry: ISolutionEntry;
  public pageSize: number = 10;
  public totalItems: number;
  public activeProcessInstanceCount: number;
  public paginationSize: number = 10;
  public initialLoadingFinished: boolean = false;
  public processInstancesToDisplay: Array<DataModels.Correlations.ProcessInstance> = [];
  public showError: boolean;
  public pagination: Pagination;
  public paginationShowsLoading: boolean;

  private dashboardService: IDashboardService;
  private notificationService: NotificationService;
  private solutionService: ISolutionService;
  private activeSolutionUri: string;
  private router: Router;

  private subscriptions: Array<Subscription>;
  private processInstances: Array<DataModels.Correlations.ProcessInstance> = [];
  private stoppedProcessInstances: Array<DataModels.Correlations.ProcessInstance> = [];

  private solutionEventListenerId: string;

  private amountOfActiveProcessInstancesToDisplay: number = this.pageSize;
  private amountOfActiveProcessInstancesToSkip: number = 0;

  private dashboardServiceSubscriptions: Array<RuntimeSubscription> = [];

  private updatePromise: any;
  private identitiyUsedForSubscriptions: IIdentity;

  constructor(
    dashboardService: IDashboardService,
    notificationService: NotificationService,
    solutionService: ISolutionService,
    router: Router,
  ) {
    this.dashboardService = dashboardService;
    this.notificationService = notificationService;
    this.solutionService = solutionService;
    this.router = router;
  }

  public async activeSolutionEntryChanged(
    newActiveSolutionEntry: ISolutionEntry,
    previousActiveSolutionEntry: ISolutionEntry,
  ): Promise<void> {
    if (!solutionIsRemoteSolution(newActiveSolutionEntry.uri)) {
      return;
    }

    if (this.updatePromise) {
      this.updatePromise.cancel();
    }

    const previousActiveSolutionEntryExists: boolean = previousActiveSolutionEntry !== undefined;
    if (previousActiveSolutionEntryExists) {
      this.removeRuntimeSubscriptions();
    }

    if (this.solutionEventListenerId !== undefined) {
      previousActiveSolutionEntry.service.unwatchSolution(this.solutionEventListenerId);
    }

    this.solutionEventListenerId = this.activeSolutionEntry.service.watchSolution(() => {
      this.updateProcessInstanceList();
    });

    this.processInstances = [];
    this.processInstancesToDisplay = [];
    this.stoppedProcessInstances = [];
    this.initialLoadingFinished = false;

    this.dashboardService.eventAggregator.publish(
      environment.events.configPanel.solutionEntryChanged,
      newActiveSolutionEntry,
    );

    await this.updateProcessInstanceList();

    this.setRuntimeSubscriptions();
  }

  public async currentPageChanged(currentPage: number, previousPage: number): Promise<void> {
    const isInitialEvent: boolean = previousPage === undefined || previousPage === null;
    if (isInitialEvent) {
      return;
    }

    if (this.updatePromise) {
      this.updatePromise.cancel();
    }

    this.stoppedProcessInstances = [];

    const paginationWasUsed: boolean = previousPage > 0;
    const showNewerProcessInstances: boolean = currentPage > previousPage;
    if (paginationWasUsed && showNewerProcessInstances) {
      const skippedPages: number = Math.abs(currentPage - previousPage) - 1;

      this.amountOfActiveProcessInstancesToSkip +=
        this.amountOfActiveProcessInstancesToDisplay + skippedPages * this.pageSize;
    } else {
      const paginationGetsDisplayed: boolean = this.totalItems > this.pageSize;
      const pageIndex: number = paginationGetsDisplayed ? this.currentPage - 1 : 0;

      this.amountOfActiveProcessInstancesToSkip = pageIndex * this.pageSize;
    }

    this.amountOfActiveProcessInstancesToDisplay = this.pageSize;

    this.updateProcessInstanceList();
  }

  public async attached(): Promise<void> {
    this.activeSolutionUri = this.router.currentInstruction.queryParams.solutionUri;

    const activeSolutionUriIsNotSet: boolean = this.activeSolutionUri === undefined;

    if (activeSolutionUriIsNotSet) {
      this.activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    const activeSolutionUriIsNotRemote: boolean = !solutionIsRemoteSolution(this.activeSolutionUri);
    if (activeSolutionUriIsNotRemote) {
      this.activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(this.activeSolutionUri);

    await this.updateProcessInstanceList();

    this.subscriptions = [
      this.dashboardService.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, async () => {
        this.removeRuntimeSubscriptions();

        await this.updateProcessInstanceList();

        this.setRuntimeSubscriptions();
      }),
    ];

    this.setRuntimeSubscriptions();

    if (this.solutionEventListenerId === undefined) {
      this.solutionEventListenerId = this.activeSolutionEntry.service.watchSolution(() => {
        this.updateProcessInstanceList();
      });
    }
  }

  public detached(): void {
    if (this.subscriptions !== undefined) {
      for (const subscription of this.subscriptions) {
        subscription.dispose();
      }
    }

    if (this.solutionEventListenerId !== undefined) {
      this.activeSolutionEntry.service.unwatchSolution(this.solutionEventListenerId);
    }

    this.removeRuntimeSubscriptions();
  }

  public async stopProcessInstance(processInstance: DataModels.Correlations.ProcessInstance): Promise<void> {
    try {
      const onProcessTerminatedSubscription: RuntimeSubscription = await this.dashboardService.onProcessTerminated(
        this.activeSolutionEntry.identity,
        (message) => {
          if (message.processInstanceId !== processInstance.processInstanceId) {
            return;
          }

          processInstance.state = DataModels.Correlations.CorrelationState.error;

          this.dashboardService.removeSubscription(this.activeSolutionEntry.identity, onProcessTerminatedSubscription);
          this.dashboardService.removeSubscription(this.activeSolutionEntry.identity, onProcessErrorSubscription);
        },
      );
      const onProcessErrorSubscription: RuntimeSubscription = await this.dashboardService.onProcessError(
        this.activeSolutionEntry.identity,
        (message) => {
          if (message.processInstanceId !== processInstance.processInstanceId) {
            return;
          }

          processInstance.state = DataModels.Correlations.CorrelationState.error;

          this.dashboardService.removeSubscription(this.activeSolutionEntry.identity, onProcessTerminatedSubscription);
          this.dashboardService.removeSubscription(this.activeSolutionEntry.identity, onProcessErrorSubscription);
        },
      );

      await this.dashboardService.terminateProcessInstance(
        this.activeSolutionEntry.identity,
        processInstance.processInstanceId,
      );

      this.stoppedProcessInstances.push(processInstance);

      this.amountOfActiveProcessInstancesToDisplay--;

      this.updateProcessInstancesToDisplay();
    } catch (error) {
      this.notificationService.showNotification(NotificationType.ERROR, `Error while stopping Process! ${error}`);
    }
  }

  public formatDate(date: string): string {
    return getBeautifiedDate(date);
  }

  private async setRuntimeSubscriptions(): Promise<void> {
    const subscriptionsExist: boolean = this.dashboardServiceSubscriptions.length > 0;
    if (subscriptionsExist) {
      this.removeRuntimeSubscriptions();
    }

    this.identitiyUsedForSubscriptions = this.activeSolutionEntry.identity;

    this.dashboardServiceSubscriptions = await Promise.all([
      this.dashboardService.onProcessStarted(this.activeSolutionEntry.identity, async () => {
        await this.updateProcessInstanceList();
      }),
      this.dashboardService.onProcessEnded(this.activeSolutionEntry.identity, async () => {
        await this.updateProcessInstanceList();
      }),
      this.dashboardService.onProcessError(this.activeSolutionEntry.identity, async () => {
        await this.updateProcessInstanceList();
      }),
      this.dashboardService.onProcessTerminated(this.activeSolutionEntry.identity, async () => {
        await this.updateProcessInstanceList();
      }),
    ]);
  }

  private removeRuntimeSubscriptions(): void {
    for (const subscription of this.dashboardServiceSubscriptions) {
      this.dashboardService.removeSubscription(this.identitiyUsedForSubscriptions, subscription);
    }

    this.dashboardServiceSubscriptions = [];
  }

  private async updateProcessInstanceList(): Promise<void> {
    try {
      const processInstanceList: DataModels.Correlations.ProcessInstanceList = await this.getActiveProcessInstancesForCurrentPage();

      if (!processInstanceList) {
        return;
      }

      const processInstanceListWasUpdated: boolean =
        JSON.stringify(processInstanceList.processInstances) !== JSON.stringify(this.processInstances);

      this.totalItems = processInstanceList.totalCount + this.stoppedProcessInstances.length;
      this.activeProcessInstanceCount = processInstanceList.totalCount;

      if (processInstanceListWasUpdated) {
        this.processInstances = processInstanceList.processInstances;

        this.updateProcessInstancesToDisplay();
      }

      this.initialLoadingFinished = true;
      this.showError = false;
    } catch (error) {
      this.initialLoadingFinished = true;

      const errorIsForbiddenError: boolean = isError(error, ForbiddenError);
      const errorIsUnauthorizedError: boolean = isError(error, UnauthorizedError);
      const errorIsAuthenticationRelated: boolean = errorIsForbiddenError || errorIsUnauthorizedError;

      if (!errorIsAuthenticationRelated) {
        this.processInstancesToDisplay = [];
        this.processInstances = [];

        const errorIsNotNoProcessInstancesFound: boolean = error.code !== 404;

        this.showError = errorIsNotNoProcessInstancesFound;
      }
    }

    const processInstancesAreNotSet: boolean = this.processInstances === undefined || this.processInstances === null;
    if (processInstancesAreNotSet) {
      this.processInstances = [];
    }
  }

  private async getActiveProcessInstancesForCurrentPage(): Promise<DataModels.Correlations.ProcessInstanceList> {
    const identity: IIdentity = this.activeSolutionEntry.identity;

    const shouldOnlyDisplayStoppedProcessInstances: boolean = this.amountOfActiveProcessInstancesToDisplay === 0;
    if (shouldOnlyDisplayStoppedProcessInstances) {
      return undefined;
    }

    this.updatePromise = new Bluebird.Promise(
      async (resolve: Function, reject: Function): Promise<any> => {
        try {
          const activeProcessInstances = await this.dashboardService.getAllActiveProcessInstances(
            identity,
            this.amountOfActiveProcessInstancesToSkip,
            this.amountOfActiveProcessInstancesToDisplay,
          );

          resolve(activeProcessInstances);
        } catch (error) {
          reject(error);
        }
      },
    );

    return this.updatePromise;
  }

  private updateProcessInstancesToDisplay(): void {
    this.processInstancesToDisplay = this.processInstances;

    this.stoppedProcessInstances.forEach((stoppedProcessInstance: DataModels.Correlations.ProcessInstance) => {
      const processInstanceGetsDisplayed: boolean = this.processInstancesToDisplay.some(
        (processInstance: DataModels.Correlations.ProcessInstance) => {
          return stoppedProcessInstance.processInstanceId === processInstance.processInstanceId;
        },
      );

      if (!processInstanceGetsDisplayed) {
        this.processInstancesToDisplay.push(stoppedProcessInstance);
      }
    });

    this.paginationShowsLoading = false;
  }
}
