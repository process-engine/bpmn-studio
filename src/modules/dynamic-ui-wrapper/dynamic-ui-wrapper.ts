
import {bindable, inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import {domEventDispatch} from 'dom-event-dispatch';

import {IIdentity} from '@essential-projects/iam_contracts';
import {DataModels} from '@process-engine/management_api_contracts';

import {
  IBooleanFormField,
  IDynamicUiService,
  IEnumFormField,
  ISolutionEntry,
  IStringFormField,
} from '../../contracts';

@inject('DynamicUiService', Router, Element)
export class DynamicUiWrapper {

  public cancelButtonText: string = 'Cancel';
  public confirmButtonText: string = 'Continue';
  public declineButtonText: string = 'Decline';
  public onButtonClick: (action: 'cancel' | 'proceed' | 'decline') => void;
  @bindable({changeHandler: 'userTaskChanged'}) public currentUserTask: DataModels.UserTasks.UserTask;
  @bindable({changeHandler: 'manualTaskChanged'}) public currentManualTask: DataModels.ManualTasks.ManualTask;
  @bindable() public isConfirmUserTask: boolean = false;
  @bindable() public isFormUserTask: boolean = false;
  @bindable() public isModal: boolean;

  private _element: Element;
  private _router: Router;
  private _dynamicUiService: IDynamicUiService;
  private _identity: IIdentity;
  private _activeSolutionEntry: ISolutionEntry;

  constructor(dynamicUiService: IDynamicUiService,
              router: Router,
              element: Element) {

    this._dynamicUiService = dynamicUiService;
    this._router = router;
    this._element = element;

    this.isModal = false;
  }

  private testFunc(): any {
    console.log('identity');
    console.log('identity', this._identity);
    const component: any = document.getElementById('test');
    component.addEventListener('submitted', (event: any) => {
          const userTask: any = event.detail;
          console.log('userTask', userTask);
          this._finishUserTask('proceed', userTask);
        });
    console.log('component', component );
  }

  public get currentUserTaskJson(): string {
    return JSON.stringify(this.currentUserTask);
  }

  public set identity(identity: IIdentity) {
    this._identity = identity;
  }

  public set activeSolutionEntry(solutionEntry: ISolutionEntry) {
    this._activeSolutionEntry = solutionEntry;
  }

  public async handleUserTaskButtonClick(action: 'cancel' | 'proceed' | 'decline'): Promise<void> {
    const actionCanceled: boolean = action === 'cancel';

    console.log('handleUserTaskButtonClick');

    if (actionCanceled) {
      this._cancelTask();

      return;
    }

    this.isConfirmUserTask = true;
    if (this.isConfirmUserTask) {
      console.log('Right Way');
      const formFields: Array<DataModels.UserTasks.UserTaskFormField> = this._testUserTask.data.formFields;

      const booleanFormFieldIndex: number = formFields.findIndex((formField: DataModels.UserTasks.UserTaskFormField) => {
        return formField.type === DataModels.UserTasks.UserTaskFormFieldType.boolean;
      });

      const hasBooleanFormField: boolean = true; // formFields[booleanFormFieldIndex] !== undefined;

      if (hasBooleanFormField) {
        (formFields[booleanFormFieldIndex] as IBooleanFormField).value = action === 'proceed';
      }

      console.log('now calling _finishUserTask()');
      this._finishUserTask(action);
    } else if (this.isFormUserTask) {
      console.log('Wrong Way');
      this._finishUserTask(action);
    }
  }

  public async handleManualTaskButtonClick(action: 'cancel' | 'proceed'): Promise<void> {
    const actionCanceled: boolean = action === 'cancel';

    if (actionCanceled) {
      this._cancelTask();

      return;
    }

    this._finishManualTask();
  }

  public userTaskChanged(newUserTask: DataModels.UserTasks.UserTask): void {
    console.log('userTaskChanged');
    const isUserTaskEmpty: boolean = newUserTask === undefined;
    if (isUserTaskEmpty) {
      return;
    }

    const preferredControlSet: boolean = newUserTask.data.preferredControl !== undefined;

    this.isConfirmUserTask = preferredControlSet
      ? newUserTask.data.preferredControl.toLowerCase() === 'confirm'
      : false;

    this.isFormUserTask = !this.isConfirmUserTask;

    if (this.isConfirmUserTask) {
      this.confirmButtonText = 'Confirm';
      this.declineButtonText = 'Decline';
    } else {
      this.confirmButtonText = 'Continue';
      this.declineButtonText = '';
    }
  }

  public manualTaskChanged(newManualTask: DataModels.ManualTasks.ManualTask): void {
    const isManualTaskEmpty: boolean = newManualTask === undefined;
    if (isManualTaskEmpty) {
      return;
    }

    this.confirmButtonText = 'Continue';
    this.declineButtonText = '';
  }

  public get isHandlingManualTask(): boolean {
    return this.currentManualTask !== undefined;
  }

  public get isHandlingUserTask(): boolean {
    return this.currentUserTask !== undefined;
  }

  private _cancelTask(): void {
    if (this.isModal) {
      domEventDispatch.dispatchEvent(this._element, 'close-modal', {bubbles: true});

      return;
    }

    const correlationId: string = this.currentUserTask ? this.currentUserTask.correlationId : this.currentManualTask.correlationId;

    this._router.navigateToRoute('task-list-correlation', {
      correlationId: correlationId,
      solutionUri: this._activeSolutionEntry.uri,
    });
  }

  private _finishUserTask(action: 'cancel' | 'proceed' | 'decline', userTask: any): Promise<void> {
    const noUserTaskKnown: boolean = !this.isHandlingUserTask;

    if (noUserTaskKnown) {
      return;
    }

    const correlationId: string = userTask.correlationId;
    const processInstanceId: string = userTask.processInstanceId;
    const userTaskInstanceId: string = userTask.userTaskInstanceId;
    const userTaskResult: DataModels.UserTasks.UserTaskResult = userTask.results;
    console.log('_finishUserTask');
    console.log('_finishUserTask identity', this._identity);
    console.log('UserTaskID: ', userTask.userTaskInstanceId);
    this._dynamicUiService.finishUserTask(this._identity,
      processInstanceId,
      correlationId,
      userTaskInstanceId,
      userTaskResult);

    const buttonClickHandlerExists: boolean = this.onButtonClick !== undefined;
    if (buttonClickHandlerExists) {
      this.onButtonClick(action);
    }
  }

  private _finishManualTask(): Promise < void > {
    const noManualTaskKnown: boolean = !this.isHandlingManualTask;

    if (noManualTaskKnown) {
      return;
    }

    const correlationId: string = this.currentManualTask.correlationId;
    const processInstanceId: string = this.currentManualTask.processInstanceId;
    const manualTaskInstanceId: string = this.currentManualTask.flowNodeInstanceId;

    this._dynamicUiService.finishManualTask(this._identity,
      processInstanceId,
      correlationId,
      manualTaskInstanceId);

    this.currentManualTask = undefined;

    const buttonClickHandlerExists: boolean = this.onButtonClick !== undefined;
    if (buttonClickHandlerExists) {
      this.onButtonClick('proceed');
    }
  }

  private _getUserTaskResults(): DataModels.UserTasks.UserTaskResult {
    const userTaskResult: DataModels.UserTasks.UserTaskResult = {
      formFields: {},
    };

    const currentFormFields: Array<DataModels.UserTasks.UserTaskFormField> = this.currentUserTask.data.formFields;

    currentFormFields.forEach((formField: IStringFormField | IEnumFormField | IBooleanFormField) => {
      const formFieldId: string = formField.id;

      const formFieldValue: string | boolean = formField.value;
      const formFieldStringValue: string = formFieldValue !== undefined ? formFieldValue.toString() : undefined;

      userTaskResult.formFields[formFieldId] = formFieldStringValue;
    });

    return userTaskResult;
  }

}
