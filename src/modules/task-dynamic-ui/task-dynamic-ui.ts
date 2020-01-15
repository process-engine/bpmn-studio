import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, computedFrom, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import {domEventDispatch} from 'dom-event-dispatch';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {
  AuthenticationStateEvent,
  IDynamicUiService,
  ISolutionEntry,
  ISolutionService,
  NotificationType,
} from '../../contracts/index';
import {NotificationService} from '../../services/notification-service/notification.service';
import {DynamicUiWrapper} from '../dynamic-ui-wrapper/dynamic-ui-wrapper';

interface IRouteParameters {
  diagramName: string;
  solutionUri: string;
  correlationId: string;
  processInstanceId: string;
  taskId: string;
}

@inject(EventAggregator, 'DynamicUiService', Router, 'NotificationService', 'SolutionService', Element)
export class TaskDynamicUi {
  public dynamicUiWrapper: DynamicUiWrapper;

  @bindable() public correlationId: string;
  @bindable() public processModelId: string;
  @bindable() public processInstanceId: string;
  @bindable() public taskId: string;
  @bindable() public isModal: boolean;
  @bindable() public activeSolutionEntry: ISolutionEntry;
  @bindable public userTask: DataModels.UserTasks.UserTask;
  @bindable public manualTask: DataModels.ManualTasks.ManualTask;

  private activeDiagramName: string;
  private activeSolutionUri: string;
  private eventAggregator: EventAggregator;
  private router: Router;
  private notificationService: NotificationService;
  private solutionService: ISolutionService;
  private dynamicUiService: IDynamicUiService;
  private subscriptions: Array<Subscription>;
  private element: Element;
  private identity: IIdentity;

  constructor(
    eventAggregator: EventAggregator,
    dynamicUiService: IDynamicUiService,
    router: Router,
    notificationService: NotificationService,
    solutionService: ISolutionService,
    element: Element,
  ) {
    this.eventAggregator = eventAggregator;
    this.dynamicUiService = dynamicUiService;
    this.router = router;
    this.notificationService = notificationService;
    this.solutionService = solutionService;
    this.element = element;
  }

  public activate(routeParameters: IRouteParameters): void {
    // This is called when starting tasks
    this.correlationId = routeParameters.correlationId;
    this.processModelId = routeParameters.diagramName;
    this.processInstanceId = routeParameters.processInstanceId;
    this.taskId = routeParameters.taskId;
    this.activeDiagramName = routeParameters.diagramName;
    this.activeSolutionUri = routeParameters.solutionUri;

    this.activeSolutionEntry = this.solutionService.getSolutionEntryForUri(this.activeSolutionUri);
    this.identity = this.activeSolutionEntry.identity;

    this.isModal = false;
  }

  public attached(): void {
    this.dynamicUiWrapper.identity = this.identity;
    this.getTask();

    this.subscriptions = [
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGIN, () => {
        this.getTask();
      }),
      this.eventAggregator.subscribe(AuthenticationStateEvent.LOGOUT, () => {
        this.getTask();
      }),
    ];

    this.dynamicUiWrapper.onButtonClick = (): void => {
      this.finishTask();
    };

    this.setDynamicUIWrapperUserTask();
    this.setDynamicUIWrapperManualTask();
    this.dynamicUiWrapper.activeSolutionEntry = this.activeSolutionEntry;
  }

  public activeSolutionEntryChanged(newValue: ISolutionEntry): void {
    this.identity = newValue.identity;

    const dynamicUiWrapperIsUndefined: boolean = this.dynamicUiWrapper === undefined;
    if (dynamicUiWrapperIsUndefined) {
      return;
    }

    this.dynamicUiWrapper.activeSolutionEntry = newValue;
  }

  public detached(): void {
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  public userTaskChanged(): void {
    this.setDynamicUIWrapperUserTask();
  }

  public manualTaskChanged(): void {
    this.setDynamicUIWrapperManualTask();
  }

  @computedFrom('userTask', 'manualTask')
  public get taskName(): string {
    const nonWhiteSpaceRegex: RegExp = /\S/;
    const task: DataModels.UserTasks.UserTask | DataModels.ManualTasks.ManualTask =
      this.userTask === undefined ? this.manualTask : this.userTask;

    const noTaskIsSet: boolean = task === undefined;
    if (noTaskIsSet) {
      return undefined;
    }

    const taskNameIsSet: boolean = nonWhiteSpaceRegex.test(task.name);
    const taskDisplayName: string = taskNameIsSet ? task.name : task.id;

    return taskDisplayName;
  }

  public clearTasks(): void {
    this.userTask = undefined;
    this.manualTask = undefined;
  }

  private finishTask(): void {
    if (this.isModal) {
      domEventDispatch.dispatchEvent(this.element, 'close-modal', {bubbles: true});
      this.clearTasks();

      return;
    }

    const task: DataModels.UserTasks.UserTask | DataModels.ManualTasks.ManualTask =
      this.userTask === undefined ? this.manualTask : this.userTask;

    this.router.navigateToRoute('live-execution-tracker', {
      diagramName: this.activeDiagramName,
      solutionUri: this.activeSolutionUri,
      correlationId: task.correlationId,
      processInstanceId: this.processInstanceId,
    });
  }

  private async getTask(): Promise<void> {
    try {
      const processInstanceIdNotGiven: boolean = this.processInstanceId === undefined;

      if (processInstanceIdNotGiven) {
        throw Error(`Invalid ProcessInstance ID: ${this.processInstanceId}`);
      }

      this.userTask = await this.dynamicUiService.getUserTask(this.identity, this.processInstanceId, this.taskId);

      const userTaskFound: boolean = this.userTask !== undefined;
      if (userTaskFound) {
        return;
      }

      this.manualTask = await this.dynamicUiService.getManualTask(this.identity, this.processInstanceId, this.taskId);

      const manualTaskFound: boolean = this.manualTask !== undefined;
      if (manualTaskFound) {
        return;
      }

      throw new Error(`No UserTask or ManualTask with ID ${this.taskId} found!`);
    } catch (error) {
      this.notificationService.showNotification(NotificationType.ERROR, `Failed to refresh task: ${error.message}`);
      throw error;
    }
  }

  private async setDynamicUIWrapperUserTask(): Promise<void> {
    if (this.dynamicUiWrapper === undefined || this.dynamicUiWrapper === null) {
      return;
    }

    this.dynamicUiWrapper.currentUserTask = this.userTask;
  }

  private async setDynamicUIWrapperManualTask(): Promise<void> {
    if (this.dynamicUiWrapper === undefined || this.dynamicUiWrapper === null) {
      return;
    }

    this.dynamicUiWrapper.currentManualTask = this.manualTask;
  }
}
