import {bindable, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import {domEventDispatch} from 'dom-event-dispatch';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {IDynamicUiService, ISolutionEntry} from '../../contracts';

enum ButtonClickActions {
  cancel = 'cancel',
  proceed = 'proceed',
  decline = 'decline',
}

@inject('DynamicUiService', Router, Element)
export class DynamicUiWrapper {
  public onButtonClick: (action: ButtonClickActions) => void;
  @bindable() public currentUserTask: DataModels.UserTasks.UserTask;
  @bindable() public currentManualTask: DataModels.ManualTasks.ManualTask;

  @bindable() public isModal: boolean;
  public identity: IIdentity;
  public activeSolutionEntry: ISolutionEntry;

  private element: Element;
  private router: Router;
  private dynamicUiService: IDynamicUiService;

  constructor(dynamicUiService: IDynamicUiService, router: Router, element: Element) {
    this.dynamicUiService = dynamicUiService;
    this.router = router;
    this.element = element;

    this.isModal = false;
  }

  public async handleUserTaskButtonClick(
    action: ButtonClickActions,
    userTask: DataModels.UserTasks.UserTask,
    results: DataModels.UserTasks.UserTaskResult,
  ): Promise<void> {
    const actionCanceled: boolean = action === ButtonClickActions.cancel;

    if (actionCanceled) {
      this.cancelTask();

      return;
    }

    this.finishUserTask(action, userTask, results);
  }

  public async handleManualTaskButtonClick(action: ButtonClickActions): Promise<void> {
    const actionCanceled: boolean = action === ButtonClickActions.cancel;

    if (actionCanceled) {
      this.cancelTask();

      return;
    }

    this.finishManualTask();
  }

  public get isHandlingManualTask(): boolean {
    return this.currentManualTask !== undefined;
  }

  public get isHandlingUserTask(): boolean {
    return this.currentUserTask !== undefined;
  }

  private cancelTask(): void {
    if (this.isModal) {
      domEventDispatch.dispatchEvent(this.element, 'close-modal', {bubbles: true});

      return;
    }

    const correlationId: string = this.currentUserTask
      ? this.currentUserTask.correlationId
      : this.currentManualTask.correlationId;

    this.router.navigateToRoute('task-list-correlation', {
      correlationId: correlationId,
      solutionUri: this.activeSolutionEntry.uri,
    });
  }

  private finishUserTask(
    action: ButtonClickActions,
    userTask: DataModels.UserTasks.UserTask,
    results: DataModels.UserTasks.UserTaskResult,
  ): Promise<void> {
    const noUserTaskKnown: boolean = !this.isHandlingUserTask;

    if (noUserTaskKnown) {
      return;
    }

    const {correlationId, processInstanceId, flowNodeInstanceId} = userTask;
    this.dynamicUiService.finishUserTask(this.identity, processInstanceId, correlationId, flowNodeInstanceId, results);

    this.currentUserTask = undefined;

    const buttonClickHandlerExists: boolean = this.onButtonClick !== undefined;
    if (buttonClickHandlerExists) {
      this.onButtonClick(action);
    }
  }

  private finishManualTask(): Promise<void> {
    const noManualTaskKnown: boolean = !this.isHandlingManualTask;

    if (noManualTaskKnown) {
      return;
    }

    const correlationId: string = this.currentManualTask.correlationId;
    const processInstanceId: string = this.currentManualTask.processInstanceId;
    const manualTaskInstanceId: string = this.currentManualTask.flowNodeInstanceId;

    this.dynamicUiService.finishManualTask(this.identity, processInstanceId, correlationId, manualTaskInstanceId);

    this.currentManualTask = undefined;

    const buttonClickHandlerExists: boolean = this.onButtonClick !== undefined;
    if (buttonClickHandlerExists) {
      this.onButtonClick(ButtonClickActions.proceed);
    }
  }
}
