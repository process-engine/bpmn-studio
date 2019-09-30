import {Subscription} from 'aurelia-event-aggregator';
import {bindable, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {ForbiddenError, UnauthorizedError, isError} from '@essential-projects/errors_ts';
import * as Bluebird from 'bluebird';

import {AuthenticationStateEvent, ISolutionEntry, ISolutionService, NotificationType} from '../../../contracts/index';
import {getBeautifiedDate} from '../../../services/date-service/date.service';
import {NotificationService} from '../../../services/notification-service/notification.service';
import environment from '../../../environment';
import {IDashboardService} from '../dashboard/contracts';

@inject('DashboardService', 'NotificationService', 'SolutionService', Router)
export class ProcessList {
  @observable public currentPage: number = 0;
  @bindable() public activeSolutionEntry: ISolutionEntry;
  public pageSize: number = 10;
  public totalItems: number;
  public paginationSize: number = 10;
  public initialLoadingFinished: boolean = false;
  public processInstancesToDisplay: Array<DataModels.Correlations.ProcessInstance> = [];
  public showError: boolean;

  private dashboardService: IDashboardService;
  private notificationService: NotificationService;
  private solutionService: ISolutionService;
  private activeSolutionUri: string;
  private router: Router;

  private subscriptions: Array<Subscription>;
  private processInstances: Array<DataModels.Correlations.ProcessInstance> = [];
  private stoppedProcessInstances: Array<DataModels.Correlations.ProcessInstance> = [];

  private limit: number = this.pageSize;
  private offset: number = 0;

  private updatePromise: any;

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

  public async activeSolutionEntryChanged(newValue: ISolutionEntry, oldValue: ISolutionEntry): Promise<void> {
    if (!newValue.uri.includes('http')) {
      return;
    }

    if (this.updatePromise) {
      this.updatePromise.cancel();
    }

    this.processInstances = [];
    this.processInstancesToDisplay = [];
    this.stoppedProcessInstances = [];
    this.initialLoadingFinished = false;

    this.dashboardService.eventAggregator.publish(environment.events.configPanel.solutionEntryChanged, newValue);

    await this.updateProcessInstanceList();
  }

  public async currentPageChanged(newValue: number, oldValue: number): Promise<void> {
    const oldValueIsNotDefined: boolean = oldValue === undefined || oldValue === null;
    if (oldValueIsNotDefined) {
      return;
    }

    this.stoppedProcessInstances = [];
    if (newValue > oldValue) {
      const skippedPages: number = Math.abs(newValue - oldValue) - 1;

      this.offset += this.limit + skippedPages * this.pageSize;
    } else {
      const pageIndex: number = Math.max(this.currentPage - 1, 0);

      this.offset = pageIndex * this.pageSize;
    }

    this.limit = this.pageSize;

    this.updateProcessInstanceList();
  }

  public async attached(): Promise<void> {
    this.activeSolutionUri = this.router.currentInstruction.queryParams.solutionUri;

    const activeSolutionUriIsNotSet: boolean = this.activeSolutionUri === undefined;

    if (activeSolutionUriIsNotSet) {
      this.activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    const activeSolutionUriIsNotRemote: boolean = !this.activeSolutionUri.startsWith('http');
    if (activeSolutionUriIsNotRemote) {
      this.activeSolutionUri = window.localStorage.getItem('InternalProcessEngineRoute');
    }

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(this.activeSolutionUri);

    await this.updateProcessInstanceList();

    this.subscriptions = [
      this.dashboardService.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, async () => {
        await this.updateProcessInstanceList();
      }),
      this.dashboardService.eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, async () => {
        await this.updateProcessInstanceList();
      }),
    ];

    this.dashboardService.onProcessStarted(this.activeSolutionEntry.identity, async () => {
      await this.updateProcessInstanceList();
    });

    this.dashboardService.onProcessEnded(this.activeSolutionEntry.identity, async () => {
      await this.updateProcessInstanceList();
    });

    /**
     * This notification gets also triggered when the processinstance has been terminated.
     * Currently the onProcessTerminated notification does not work.
     */
    this.dashboardService.onProcessError(this.activeSolutionEntry.identity, async () => {
      await this.updateProcessInstanceList();
    });
  }

  public detached(): void {
    if (this.subscriptions !== undefined) {
      for (const subscription of this.subscriptions) {
        subscription.dispose();
      }
    }
  }

  public async stopProcessInstance(processInstance: DataModels.Correlations.ProcessInstance): Promise<void> {
    try {
      this.dashboardService.onProcessError(this.activeSolutionEntry.identity, () => {
        processInstance.state = DataModels.Correlations.CorrelationState.error;
      });

      await this.dashboardService.terminateProcessInstance(
        this.activeSolutionEntry.identity,
        processInstance.processInstanceId,
      );

      this.stoppedProcessInstances.push(processInstance);

      this.limit--;

      this.updateProcessInstancesToDisplay();
    } catch (error) {
      this.notificationService.showNotification(NotificationType.ERROR, `Error while stopping Process! ${error}`);
    }
  }

  public formatDate(date: string): string {
    return getBeautifiedDate(date);
  }

  private async updateProcessInstanceList(): Promise<void> {
    try {
      const processInstanceList: DataModels.Correlations.ProcessInstanceList = await this.getActiveProcessInstancesForCurrentPage();

      if (!processInstanceList) {
        return;
      }

      const sortedProcessInstances: Array<
        DataModels.Correlations.ProcessInstance
      > = processInstanceList.processInstances.sort(this.sortProcessInstances);

      const processInstanceListWasUpdated: boolean =
        JSON.stringify(sortedProcessInstances) !== JSON.stringify(this.processInstances);

      if (processInstanceListWasUpdated) {
        this.processInstances = sortedProcessInstances;

        this.totalItems = processInstanceList.totalCount;

        this.updateProcessInstancesToDisplay();
      }

      this.initialLoadingFinished = true;
    } catch (error) {
      this.initialLoadingFinished = true;

      const errorIsForbiddenError: boolean = isError(error, ForbiddenError);
      const errorIsUnauthorizedError: boolean = isError(error, UnauthorizedError);
      const errorIsAuthenticationRelated: boolean = errorIsForbiddenError || errorIsUnauthorizedError;

      if (!errorIsAuthenticationRelated) {
        this.processInstancesToDisplay = [];
        this.processInstances = [];
        this.showError = true;
      }
    }

    const processInstancesAreNotSet: boolean = this.processInstances === undefined || this.processInstances === null;
    if (processInstancesAreNotSet) {
      this.processInstances = [];
    }
  }

  private async getActiveProcessInstancesForCurrentPage(): Promise<DataModels.Correlations.ProcessInstanceList> {
    const identity: IIdentity = this.activeSolutionEntry.identity;

    const shouldOnlyDisplayStoppedProcessInstances: boolean = this.limit < 1;
    if (shouldOnlyDisplayStoppedProcessInstances) {
      return undefined;
    }

    this.updatePromise = new Bluebird.Promise(
      async (resolve: Function, reject: Function): Promise<any> => {
        try {
          const activeProcessInstances = await this.dashboardService.getAllActiveProcessInstances(
            identity,
            this.offset,
            this.limit,
          );

          resolve(activeProcessInstances);
        } catch (error) {
          reject(error);
        }
      },
    );

    return this.updatePromise;
  }

  private sortProcessInstances(
    firstProcessInstance: DataModels.Correlations.ProcessInstance,
    secondProcessInstance: DataModels.Correlations.ProcessInstance,
  ): number {
    return (
      Date.parse(secondProcessInstance.createdAt.toString()) - Date.parse(firstProcessInstance.createdAt.toString())
    );
  }

  private updateProcessInstancesToDisplay(): void {
    this.processInstancesToDisplay = this.processInstances;

    this.stoppedProcessInstances.forEach((stoppedProcessInstance: DataModels.Correlations.ProcessInstance) => {
      const processInstanceExistInDisplayArray: boolean = this.processInstancesToDisplay.some(
        (processInstance: DataModels.Correlations.ProcessInstance) => {
          return stoppedProcessInstance.processInstanceId === processInstance.processInstanceId;
        },
      );

      if (!processInstanceExistInDisplayArray) {
        this.processInstancesToDisplay.push(stoppedProcessInstance);
      }
    });

    this.processInstancesToDisplay.sort(this.sortProcessInstances);
  }
}
