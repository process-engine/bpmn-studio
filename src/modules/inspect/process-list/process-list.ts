import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels, IManagementApi} from '@process-engine/management_api_contracts';

import {ForbiddenError, UnauthorizedError, isError} from '@essential-projects/errors_ts';
import {AuthenticationStateEvent, ISolutionEntry, ISolutionService, NotificationType} from '../../../contracts/index';
import {getBeautifiedDate} from '../../../services/date-service/date.service';
import {NotificationService} from '../../../services/notification-service/notification.service';
import environment from '../../../environment';

type ProcessInstanceWithCorrelation = {
  processInstance: DataModels.Correlations.CorrelationProcessInstance;
  correlation: DataModels.Correlations.Correlation;
};

@inject('ManagementApiClientService', EventAggregator, 'NotificationService', 'SolutionService', Router)
export class ProcessList {
  @observable public currentPage: number = 1;
  @bindable() public activeSolutionEntry: ISolutionEntry;
  public pageSize: number = 10;
  public totalItems: number;
  public paginationSize: number = 10;
  public requestSuccessful: boolean = false;
  public processInstancesToDisplay: Array<ProcessInstanceWithCorrelation> = [];
  public showError: boolean;

  private managementApiService: IManagementApi;
  private eventAggregator: EventAggregator;
  private notificationService: NotificationService;
  private solutionService: ISolutionService;
  private activeSolutionUri: string;
  private router: Router;

  private subscriptions: Array<Subscription>;
  private correlations: Array<DataModels.Correlations.Correlation> = [];
  private processInstancesWithCorrelation: Array<ProcessInstanceWithCorrelation> = [];
  private stoppedProcessInstancesWithCorrelation: Array<ProcessInstanceWithCorrelation> = [];

  constructor(
    managementApiService: IManagementApi,
    eventAggregator: EventAggregator,
    notificationService: NotificationService,
    solutionService: ISolutionService,
    router: Router,
  ) {
    this.managementApiService = managementApiService;
    this.eventAggregator = eventAggregator;
    this.notificationService = notificationService;
    this.solutionService = solutionService;
    this.router = router;
  }

  public async activeSolutionEntryChanged(newValue: ISolutionEntry): Promise<void> {
    if (!newValue.uri.includes('http')) {
      return;
    }

    this.correlations = [];
    this.processInstancesWithCorrelation = [];
    this.processInstancesToDisplay = [];
    this.stoppedProcessInstancesWithCorrelation = [];
    this.requestSuccessful = false;

    this.eventAggregator.publish(environment.events.configPanel.solutionEntryChanged, newValue);
    await this.updateCorrelationList();
  }

  public async currentPageChanged(newValue: number, oldValue: number): Promise<void> {
    const oldValueIsDefined: boolean = oldValue !== undefined && oldValue !== null;

    if (oldValueIsDefined) {
      this.updateCorrelationsToDisplay();
    }
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

    await this.updateCorrelationList();

    this.subscriptions = [
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, async () => {
        await this.updateCorrelationList();
      }),
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, async () => {
        await this.updateCorrelationList();
      }),
    ];

    this.managementApiService.onProcessStarted(this.activeSolutionEntry.identity, async () => {
      await this.updateCorrelationList();
    });

    this.managementApiService.onProcessEnded(this.activeSolutionEntry.identity, async () => {
      await this.updateCorrelationList();
    });

    /**
     * This notification gets also triggered when the processinstance has been terminated.
     * Currently the onProcessTerminated notification does not work.
     */
    this.managementApiService.onProcessError(this.activeSolutionEntry.identity, async () => {
      await this.updateCorrelationList();
    });
  }

  public detached(): void {
    if (this.subscriptions !== undefined) {
      for (const subscription of this.subscriptions) {
        subscription.dispose();
      }
    }
  }

  public async updateCorrelationList(): Promise<void> {
    try {
      const correlations: Array<DataModels.Correlations.Correlation> = await this.getAllActiveCorrelations();
      const correlationListWasUpdated: boolean =
        JSON.stringify(correlations.sort(this.sortCorrelations)) !== JSON.stringify(this.correlations);

      if (correlationListWasUpdated) {
        this.correlations = correlations;
        this.correlations.sort(this.sortCorrelations);

        this.processInstancesWithCorrelation = [];
        for (const correlation of this.correlations) {
          const processInstancesWithCorrelation: Array<
            ProcessInstanceWithCorrelation
          > = correlation.processInstances.map(
            (processInstance: DataModels.Correlations.CorrelationProcessInstance) => {
              return {
                processInstance: processInstance,
                correlation: correlation,
              };
            },
          );

          this.processInstancesWithCorrelation.push(...processInstancesWithCorrelation);
        }

        this.updateCorrelationsToDisplay();
      }

      this.requestSuccessful = true;
    } catch (error) {
      this.requestSuccessful = true;

      const errorIsForbiddenError: boolean = isError(error, ForbiddenError);
      const errorIsUnauthorizedError: boolean = isError(error, UnauthorizedError);
      const errorIsAuthenticationRelated: boolean = errorIsForbiddenError || errorIsUnauthorizedError;

      if (!errorIsAuthenticationRelated) {
        this.processInstancesToDisplay = [];
        this.processInstancesWithCorrelation = [];
        this.correlations = [];
        this.showError = true;
      }
    }

    const correlationsAreNotSet: boolean = this.correlations === undefined || this.correlations === null;
    if (correlationsAreNotSet) {
      this.correlations = [];
      this.processInstancesWithCorrelation = [];
    }

    this.totalItems = this.processInstancesWithCorrelation.length;
  }

  public async stopProcessInstance(
    processInstance: DataModels.Correlations.CorrelationProcessInstance,
    correlation: DataModels.Correlations.Correlation,
  ): Promise<void> {
    try {
      this.managementApiService.onProcessError(this.activeSolutionEntry.identity, () => {
        processInstance.state = DataModels.Correlations.CorrelationState.error;
      });

      await this.managementApiService.terminateProcessInstance(
        this.activeSolutionEntry.identity,
        processInstance.processInstanceId,
      );

      const processInstanceWithCorrelation: ProcessInstanceWithCorrelation = {
        processInstance: processInstance,
        correlation: correlation,
      };

      this.stoppedProcessInstancesWithCorrelation.push(processInstanceWithCorrelation);

      await this.updateCorrelationList();
    } catch (error) {
      this.notificationService.showNotification(NotificationType.ERROR, `Error while stopping Process! ${error}`);
    }
  }

  public formatDate(date: string): string {
    return getBeautifiedDate(date);
  }

  private async getAllActiveCorrelations(): Promise<Array<DataModels.Correlations.Correlation>> {
    const identity: IIdentity = this.activeSolutionEntry.identity;

    return this.managementApiService.getActiveCorrelations(identity);
  }

  private sortCorrelations(
    correlation1: DataModels.Correlations.Correlation,
    correlation2: DataModels.Correlations.Correlation,
  ): number {
    return Date.parse(correlation2.createdAt.toString()) - Date.parse(correlation1.createdAt.toString());
  }

  private sortProcessInstancesWithCorrelation(
    firstProcessInstanceWithCorrelation: ProcessInstanceWithCorrelation,
    secondProcessInstanceWithCorrelation: ProcessInstanceWithCorrelation,
  ): number {
    const firstCorrelation: DataModels.Correlations.Correlation = firstProcessInstanceWithCorrelation.correlation;
    const secondCorrelation: DataModels.Correlations.Correlation = secondProcessInstanceWithCorrelation.correlation;

    const correlationsAreDifferent: boolean = firstCorrelation.id !== secondCorrelation.id;
    if (correlationsAreDifferent) {
      return Date.parse(secondCorrelation.createdAt.toString()) - Date.parse(firstCorrelation.createdAt.toString());
    }

    const firstProcessInstance: DataModels.Correlations.CorrelationProcessInstance =
      firstProcessInstanceWithCorrelation.processInstance;
    const secondProcessInstance: DataModels.Correlations.CorrelationProcessInstance =
      secondProcessInstanceWithCorrelation.processInstance;

    return (
      Date.parse(secondProcessInstance.createdAt.toString()) - Date.parse(firstProcessInstance.createdAt.toString())
    );
  }

  private updateCorrelationsToDisplay(): void {
    const firstProcessInstanceIndex: number = (this.currentPage - 1) * this.pageSize;
    const lastProcessInstanceIndex: number = this.pageSize * this.currentPage;

    this.processInstancesToDisplay = this.processInstancesWithCorrelation;

    this.stoppedProcessInstancesWithCorrelation.forEach(
      (stoppedProcessInstanceWithCorrelation: ProcessInstanceWithCorrelation) => {
        const processInstanceExistInDisplayArray: boolean = this.processInstancesToDisplay.some(
          (processInstanceWithCorrelation: ProcessInstanceWithCorrelation) => {
            return (
              stoppedProcessInstanceWithCorrelation.processInstance === processInstanceWithCorrelation.processInstance
            );
          },
        );

        if (!processInstanceExistInDisplayArray) {
          this.processInstancesToDisplay.push(stoppedProcessInstanceWithCorrelation);
        }
      },
    );

    this.processInstancesToDisplay.sort(this.sortProcessInstancesWithCorrelation);
    this.processInstancesToDisplay = this.processInstancesToDisplay.slice(
      firstProcessInstanceIndex,
      lastProcessInstanceIndex,
    );
  }
}
