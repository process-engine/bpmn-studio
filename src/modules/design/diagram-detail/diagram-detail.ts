import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {inject, observable} from 'aurelia-framework';
import {Redirect, Router} from 'aurelia-router';
import {ValidateEvent, ValidationController} from 'aurelia-validation';

import {Event, EventList, IManagementApi} from '@process-engine/management_api_contracts';
import {ProcessModelExecution} from '@process-engine/management_api_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IElementRegistry,
        IExtensionElement,
        IFormElement,
        IModdleElement,
        IShape,
        ISolutionEntry,
        ISolutionService,
        NotificationType} from '../../../contracts/index';
import environment from '../../../environment';
import {NotificationService} from '../../notification/notification.service';
import {BpmnIo} from '../bpmn-io/bpmn-io';

interface RouteParameters {
  diagramName?: string;
}

@inject('ManagementApiClientService',
        'NotificationService',
        'SolutionService',
        EventAggregator,
        Router,
        ValidationController)
export class DiagramDetail {

  public activeDiagram: IDiagram;
  public bpmnio: BpmnIo;
  public showUnsavedChangesModal: boolean = false;
  public showSaveForStartModal: boolean = false;
  public showSaveBeforeDeployModal: boolean = false;
  public showStartEventModal: boolean = false;
  public processesStartEvents: Array<Event> = [];
  public selectedStartEventId: string;

  @observable({ changeHandler: 'diagramHasChangedChanged'}) private _diagramHasChanged: boolean;
  private _activeSolutionEntry: ISolutionEntry;
  private _notificationService: NotificationService;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;
  private _router: Router;
  private _validationController: ValidationController;
  private _diagramIsInvalid: boolean = false;
  private _ipcRenderer: any;
  private _solutionService: ISolutionService;
  private _managementApiClient: IManagementApi;

  constructor(managementApiClient: IManagementApi,
              notificationService: NotificationService,
              solutionService: ISolutionService,
              eventAggregator: EventAggregator,
              router: Router,
              validationController: ValidationController) {
    this._notificationService = notificationService;
    this._solutionService = solutionService;
    this._eventAggregator = eventAggregator;
    this._router = router;
    this._validationController = validationController;
    this._managementApiClient = managementApiClient;
  }

  public determineActivationStrategy(): string {
    return 'replace';
  }

  public async activate(routeParameters: RouteParameters): Promise<void> {

    this._activeSolutionEntry = await this._solutionService.getActiveSolutionEntry();

    const diagramNameIsNotSet: boolean = routeParameters.diagramName === undefined;
    if (diagramNameIsNotSet) {
      return;
    }

    this.activeDiagram = await this._activeSolutionEntry.service.loadDiagram(routeParameters.diagramName);

    if (this.activeDiagram === undefined) {
      this.activeDiagram = this._solutionService.getActiveDiagram();
    }

    this._solutionService.setActiveDiagram(this.activeDiagram);
    this._diagramHasChanged = false;

    const isRunningInElectron: boolean = Boolean((window as any).nodeRequire);
    if (isRunningInElectron) {
      this._prepareSaveModalForClosing();
    }
  }

  public attached(): void {

    this._eventAggregator.publish(environment.events.navBar.updateActiveSolutionAndDiagram);

    this._eventAggregator.publish(environment.events.navBar.showTools);

    this._eventAggregator.publish(environment.events.statusBar.showDiagramViewButtons);

    this._subscriptions = [
      this._validationController.subscribe((event: ValidateEvent) => {
        this._handleFormValidateEvents(event);
      }),
      this._eventAggregator.subscribe(environment.events.processDefDetail.saveDiagram, () => {
        this._saveDiagram();
      }),
      this._eventAggregator.subscribe(environment.events.processDefDetail.uploadProcess, () => {
        this._checkIfDiagramIsSavedBeforeDeploy();
      }),
      this._eventAggregator.subscribe(environment.events.differsFromOriginal, (savingNeeded: boolean) => {
        this._diagramHasChanged = savingNeeded;
      }),
      this._eventAggregator.subscribe(environment.events.navBar.validationError, () => {
        this._diagramIsInvalid = true;
      }),
      this._eventAggregator.subscribe(environment.events.navBar.noValidationError, () => {
        this._diagramIsInvalid = false;
      }),
      this._eventAggregator.subscribe(environment.events.processDefDetail.startProcess, () => {
        this._showStartDialog();
      }),
    ];
  }

  public async canDeactivate(): Promise<Redirect> {

    const _modal: Promise<boolean> = new Promise((resolve: Function, reject: Function): boolean | void => {
      if (!this._diagramHasChanged) {
        resolve(true);
      } else {
        this.showUnsavedChangesModal = true;

        // register onClick handler
        document.getElementById('dontSaveButtonLeaveView').addEventListener('click', () => {
          this.showUnsavedChangesModal = false;
          this._diagramHasChanged = false;
          this._eventAggregator.publish(environment.events.navBar.diagramChangesResolved);
          resolve(true);
        });
        document.getElementById('saveButtonLeaveView').addEventListener('click', () => {
          if (this._diagramIsInvalid) {
            resolve(false);
          }

          this.showUnsavedChangesModal = false;
          this._saveDiagram();
          this._diagramHasChanged = false;
          resolve(true);
        });
        document.getElementById('cancelButtonLeaveView').addEventListener('click', () => {
          this.showUnsavedChangesModal = false;
          resolve(false);
        });
      }
    });

    const result: boolean = await _modal;
    if (result === false) {
      /*
       * As suggested in https://github.com/aurelia/router/issues/302, we use
       * the router directly to navigate back, which results in staying on this
       * component-- and this is the desired behaviour.
       */
      return new Redirect(this._router.currentInstruction.fragment, {trigger: false, replace: false});
    }
  }

  public deactivate(): void {
    this._eventAggregator.publish(environment.events.navBar.hideTools);
    this._eventAggregator.publish(environment.events.navBar.noValidationError);
    this._eventAggregator.publish(environment.events.statusBar.hideDiagramViewButtons);
  }

  public detached(): void {
    // this._solutionService.setActiveDiagram(this.activeDiagram);

    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }

  /**
   * Saves the current diagram to disk and deploys it to the
   * process engine.
   */
  public async saveDiagramAndDeploy(): Promise<void> {
    this.showSaveBeforeDeployModal = false;
    await this._saveDiagram();
    await this.uploadProcess();
  }

  /**
   * Dismisses the saveBeforeDeploy modal.
   */
  public cancelSaveBeforeDeployModal(): void {
    this.showSaveBeforeDeployModal = false;
  }

  /**
   * Uploads the current diagram to the connected ProcessEngine.
   */
  public async uploadProcess(): Promise<void> {
    const rootElements: Array<IModdleElement> = this.bpmnio.modeler._definitions.rootElements;

    const processModel: IModdleElement = rootElements.find((definition: IModdleElement) => {
      return definition.$type === 'bpmn:Process';
    });
    const processModelId: string = processModel.id;

    try {

      const connectedProcessEngineRoute: string = window.localStorage.getItem('processEngineRoute');
      const solutionToDeployTo: ISolutionEntry = this._solutionService.getSolutionEntryForUri(connectedProcessEngineRoute);

      this.activeDiagram.id = processModelId;

      await solutionToDeployTo.service.saveDiagram(this.activeDiagram, connectedProcessEngineRoute);

      this._solutionService.setActiveSolution(solutionToDeployTo);
      this._activeSolutionEntry = solutionToDeployTo;
      this.activeDiagram = await this._activeSolutionEntry.service.loadDiagram(processModelId);

      this._eventAggregator.publish(environment.events.navBar.updateActiveSolutionAndDiagram,
        {
          solutionEntry: solutionToDeployTo,
          diagram: this.activeDiagram,
        });

      this._notificationService
          .showNotification(NotificationType.SUCCESS, 'Diagram was successfully uploaded to the connected ProcessEngine.');

      // Since a new processmodel was uploaded, we need to refresh any processmodel lists.
      this._eventAggregator.publish(environment.events.refreshProcessDefs);
      this._eventAggregator.publish(environment.events.diagramDetail.onDiagramDeployed, processModelId);

    } catch (error) {
      this._notificationService
          .showNotification(NotificationType.ERROR, `Unable to update diagram: ${error}.`);
    }
  }

  public diagramHasChangedChanged(): void {
    const isRunningInElectron: boolean = this._ipcRenderer !== undefined;
    if (isRunningInElectron) {
      const canNotClose: boolean = this._diagramHasChanged;

      this._ipcRenderer.send('can-not-close', canNotClose);
    }
  }

  public async startProcess(): Promise<void> {

    if (this.selectedStartEventId === null) {
      return;
    }

    this._dropInvalidFormData();

    const startRequestPayload: ProcessModelExecution.ProcessStartRequestPayload = {
      inputValues: {},
    };

    try {
      const response: ProcessModelExecution.ProcessStartResponsePayload = await this._managementApiClient
        .startProcessInstance(this._activeSolutionEntry.identity,
                              this.activeDiagram.id,
                              this.selectedStartEventId,
                              startRequestPayload,
                              undefined,
                              undefined);

      const correlationId: string = response.correlationId;

      this._router.navigateToRoute('waiting-room', {
        correlationId: correlationId,
        processModelId: this.activeDiagram.id,
      });
    } catch (error) {
      this.
        _notificationService
        .showNotification(
          NotificationType.ERROR,
          error.message,
        );
    }
  }

  private _prepareSaveModalForClosing(): void {
    this._ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;

    this._ipcRenderer.on('show-close-modal', () => {
      const leaveWithoutSaving: EventListenerOrEventListenerObject =  (): void => {
        this._ipcRenderer.send('can-not-close', false);
        this._ipcRenderer.send('close-bpmn-studio');
      };

      const leaveWithSaving: EventListenerOrEventListenerObject = async(): Promise<void> => {
        if (this._diagramIsInvalid) {
          return;
        }

        this.showUnsavedChangesModal = false;
        await this._saveDiagram();
        this._diagramHasChanged = false;

        this._ipcRenderer.send('close-bpmn-studio');
      };

      const doNotLeave: EventListenerOrEventListenerObject = (): void => {
        this.showUnsavedChangesModal = false;

        document.getElementById('dontSaveButtonLeaveView').removeEventListener('click', leaveWithoutSaving);
        document.getElementById('saveButtonLeaveView').removeEventListener('click', leaveWithSaving);
        document.getElementById('cancelButtonLeaveView').removeEventListener('click', doNotLeave);
      };

      document.getElementById('dontSaveButtonLeaveView').addEventListener('click', leaveWithoutSaving);
      document.getElementById('saveButtonLeaveView').addEventListener('click', leaveWithSaving );
      document.getElementById('cancelButtonLeaveView').addEventListener('click', doNotLeave);

      this.showUnsavedChangesModal = true;
    });
  }

  public async saveChangesBeforeStart(): Promise<void> {
    this._saveDiagram();
    await this.showSelectStartEventDialog();
  }

  /**
   * Opens a modal dialog to ask the user, which StartEvent he want's to
   * use to start the process.
   *
   * If there is only one StartEvent this method will select this StartEvent by
   * default.
   */
  public async showSelectStartEventDialog(): Promise<void> {
    await this._updateProcessStartEvents();

    const onlyOneStarteventAvailable: boolean = this.processesStartEvents.length === 1;

    if (onlyOneStarteventAvailable) {
      this.selectedStartEventId = this.processesStartEvents[0].id;
      this.startProcess();

      return;
    }

    this.showStartEventModal = true;
    this.showSaveForStartModal = false;

  }

  private async _updateProcessStartEvents(): Promise<void> {
    const startEventResponse: EventList = await this._managementApiClient
      .getStartEventsForProcessModel(this._activeSolutionEntry.identity, this.activeDiagram.id);

    this.processesStartEvents = startEventResponse.events;
  }

  /**
   * Checks, if the diagram is saved before it can be deployed.
   *
   * If not, the user will be ask to save the diagram.
   */
  private async _checkIfDiagramIsSavedBeforeDeploy(): Promise<void> {
    if (this._diagramHasChanged) {
      this.showSaveBeforeDeployModal = true;
    } else {
      await this.uploadProcess();
    }
  }

  /**
   * Opens a modal, if the diagram has unsaved changes and ask the user,
   * if he wants to save his changes. This is necessary to
   * execute the process.
   *
   * If there are no unsaved changes, no modal will be displayed.
   */
  private async _showStartDialog(): Promise<void> {

    this._diagramHasChanged
      ? this.showSaveForStartModal = true
      : await this.showSelectStartEventDialog();
  }

  private _handleFormValidateEvents(event: ValidateEvent): void {
    const eventIsValidateEvent: boolean = event.type !== 'validate';

    if (eventIsValidateEvent) {
      return;
    }

    for (const result of event.results) {
      const resultIsNotValid: boolean = result.valid === false;

      if (resultIsNotValid) {
        this._eventAggregator
          .publish(environment.events.navBar.validationError);
        this._diagramIsInvalid = true;

        return;
      }
    }

    this._eventAggregator
      .publish(environment.events.navBar.noValidationError);
    this._diagramIsInvalid = false;
  }

  /**
   * In the current implementation this method only checks for UserTasks that have
   * empty or otherwise not allowed FormData in them.
   *
   * If that is the case the method will continue by deleting unused/not allowed
   * FormData to make sure the diagrams XML is further supported by Camunda.
   *
   * TODO: Look further into this if this method is not better placed at the FormsSection
   * in the Property Panel, also split this into two methods and name them right.
   */
  private _dropInvalidFormData(): void {
    const registry: IElementRegistry = this.bpmnio.modeler.get('elementRegistry');

    registry.forEach((element: IShape) => {

      const elementIsUserTask: boolean = element.type === 'bpmn:UserTask';

      if (elementIsUserTask) {
        const businessObj: IModdleElement = element.businessObject;

        const businessObjHasExtensionElements: boolean = businessObj.extensionElements !== undefined;
        if (businessObjHasExtensionElements) {
          const extensions: IExtensionElement = businessObj.extensionElements;

          extensions.values = extensions.values.filter((value: IFormElement) => {
            const typeIsNotCamundaFormData: boolean = value.$type !== 'camunda:FormData';
            const elementContainsFields: boolean = (value.fields !== undefined) && (value.fields.length > 0);

            const keepThisValue: boolean = typeIsNotCamundaFormData || elementContainsFields;
            return keepThisValue;
          });

          const noExtensionValuesSet: boolean = extensions.values.length === 0;

          if (noExtensionValuesSet) {
            delete businessObj.extensionElements;
          }
        }
      }
    });
  }

  /**
   * Saves the current diagram.
   */
  private async _saveDiagram(): Promise<void> {

    if (this._diagramIsInvalid) {
      // TODO: Try to get some more information out of this: Why was it invalid? This message is not very helpful to the user.
      this._notificationService.showNotification(NotificationType.WARNING, `The diagram could not be saved because it is invalid!`);

      return;
    }

    try {
      const xml: string = await this.bpmnio.getXML();
      this.activeDiagram.xml = xml;

      const connectedProcessEngineRoute: string = window.localStorage.getItem('processEngineRoute');
      const solutionToDeployTo: ISolutionEntry = this._solutionService.getSolutionEntryForUri(connectedProcessEngineRoute);

      if (this.activeDiagram.uri.startsWith('http')) {
        this._activeSolutionEntry = solutionToDeployTo;
        await this._activeSolutionEntry.service.saveDiagram(this.activeDiagram, connectedProcessEngineRoute);

      } else {
        await this._activeSolutionEntry.service.saveDiagram(this.activeDiagram);
      }
      // this.activeDiagram.id = processModelId;

      this._solutionService.setActiveSolutionEntry(this._activeSolutionEntry);
      // this.activeDiagram = await this._activeSolutionEntry.service.loadDiagram(processModelId);
      this._solutionService.setActiveDiagram(this.activeDiagram);

      // const activeSolution: ISolutionEntry = this._solutionService.getActiveSolutionEntry();
      // await this._activeSolutionEntry.service.saveDiagram(this.activeDiagram, this._activeSolutionEntry.uri);
      // this._solutionService.setActiveSolutionEntry(this._activeSolutionEntry);

      // this._solutionService.setActiveDiagram(this.activeDiagram);

      this._diagramHasChanged = false;
      this._notificationService
          .showNotification(NotificationType.SUCCESS, `File saved!`);
      this._eventAggregator.publish(environment.events.navBar.diagramChangesResolved);
    } catch (error) {
      console.log(error);
      this._notificationService
          .showNotification(NotificationType.ERROR, `Unable to save the file: ${error}.`);
    }
  }
}
