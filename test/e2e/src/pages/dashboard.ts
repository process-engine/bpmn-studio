import {
  by,
  element,
  ElementArrayFinder,
  ElementFinder,
} from 'protractor';

import {
  By,
  promise,
} from 'selenium-webdriver';

export class Dashboard {

  // Define Links, Urls, Classes
  public dashboardLink: string = 'dashboard';
  public inspectLink: string = '/inspect';
  private _domProcessIdPrefix: string = 'processList-';
  private _domProcessClassName: string = 'process-list-item';

  private _domTaskIdPrefix: string = 'taskList-';
  private _domTaskClassName: string = 'task-list-item';

  // Define Elements
  private _byTagName: By = by.tagName('process-list');
  private _byDomProcessClassName: By = by.className(this._domProcessClassName);
  private _byDomTaskClassName: By = by.className(this._domTaskClassName);
  private _byIdTaskListContainer: By = by.id('taskListContainer');
  private _byIdDynamicUiWrapper: By = by.id('dynamic-ui-wrapper-continue-button');
  private _byProcessListItemModelName: By = by.className('process-list-item-modelname');
  private _byProcessListItemUserTasks: By = by.className('process-list-item-user-tasks');
  private _byTaskListContinueButton: By = by.className('task-list-continue-button');

  public processListTag: ElementFinder = element(this._byTagName);
  public taskListContainer: ElementFinder = element(this._byIdTaskListContainer);
  public dynamicUiWrapperContinueButton: ElementFinder = element(this._byIdDynamicUiWrapper);

  public processRunningListItems: ElementArrayFinder =
    this.processListTag
      .all(this._byDomProcessClassName);

  public firstProcessRunningListItems: ElementFinder =
    this.processRunningListItems
      .first();

  public firstTaskListItems: ElementFinder =
    this.taskListContainer
      .all(this._byDomTaskClassName)
        .first();

  // Define Functions
  public async countOfProcessRunningListItems(): Promise<number> {
    return this.processListTag
            .all(this._byDomProcessClassName)
            .count();
  }

  public async countOfProcessRunningListItemsByCorrelationId(correlationId: string): Promise<number> {
    const id: string = this._domProcessIdPrefix + correlationId;
    const byId: By = by.id(id);

    return await this.processListTag
                  .all(byId)
                  .count();
  }
  public firstProcessRunningListItemsById(correlationId: string): ElementFinder {
    const id: string = this._domProcessIdPrefix + correlationId;
    const byId: By = by.id(id);

    return this.processListTag
            .all(byId)
            .first();
  }

  public hyperlinkOfProcessRunningListItemByCorrelationId(correlationId: string): ElementFinder {
    const firstProcessRunningListItemsById: ElementFinder = this.firstProcessRunningListItemsById(correlationId);

    return firstProcessRunningListItemsById
            .element(this._byProcessListItemModelName);
  }

  public openProcessModelByClickOnModelIdInProcessRunningList(correlationId: string): promise.Promise<void> {
    const hyperlinkOfProcessRunningListItemByCorrelationId: ElementFinder = this.hyperlinkOfProcessRunningListItemByCorrelationId(correlationId);

    return hyperlinkOfProcessRunningListItemByCorrelationId.click();
  }

  public hyperlinkOfUserTasksInProcessRunningListItemByCorrelationId(correlationId: string): ElementFinder {
    const byClassName: By = this._byProcessListItemUserTasks;
    const firstProcessRunningListItemsById: ElementFinder = this.firstProcessRunningListItemsById(correlationId);

    return firstProcessRunningListItemsById
            .element(byClassName);
  }
  public openUserTasksByClickOnModelIdInProcessRunningList(correlationId: string): promise.Promise<void> {
    const hyperlinkOfUserTasksInProcessRunningListItemByCorrelationId: ElementFinder
          = this.hyperlinkOfUserTasksInProcessRunningListItemByCorrelationId(correlationId);

    return hyperlinkOfUserTasksInProcessRunningListItemByCorrelationId.click();
  }

  // task list section
  public firstTaskWaitingById(processId: string): ElementFinder {
    const id: string = this._domTaskIdPrefix + processId;
    const byId: By = by.id(id);

    return this.taskListContainer
            .all(byId)
            .first();
  }

  public async countOfTasksWaitingListItems(): Promise<number> {
    return this.taskListContainer
            .all(this._byDomTaskClassName)
            .count();
  }
  public async countOfTasksWaitingListItemsById(processModelId: string): Promise<number> {
    const id: string = this._domTaskIdPrefix + processModelId;
    const byId: By = by.id(id);

    return this.taskListContainer
            .all(byId)
            .count();
  }

  public continueTaskByClickOnButton(processModelId: string): promise.Promise<void> {
    const firstTaskWaitingById: ElementFinder = this.firstTaskWaitingById(processModelId);
    const taskListContinueButton: ElementFinder = firstTaskWaitingById.element(this._byTaskListContinueButton);

    return taskListContinueButton.click();
  }

  // user task section
  public continueUserTaskByClickOnDynamicUiWrapperContinueButton(): promise.Promise<void> {
    return this.dynamicUiWrapperContinueButton.click();
  }
}
