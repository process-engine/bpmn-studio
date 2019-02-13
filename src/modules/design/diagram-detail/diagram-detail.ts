import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, bindingMode, computedFrom, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import {ValidateEvent, ValidationController} from 'aurelia-validation';

import {DataModels, IManagementApi} from '@process-engine/management_api_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {
  IConnection,
  IElementRegistry,
  IExtensionElement,
  IFormElement,
  IModdleElement,
  IShape,
  ISolutionEntry,
  ISolutionService,
  IUserInputValidationRule,
  NotificationType,
} from '../../../contracts/index';
import environment from '../../../environment';
import {NotificationService} from '../../notification/notification.service';
import {BpmnIo} from '../bpmn-io/bpmn-io';

@inject('ManagementApiClientService',
        'NotificationService',
        'SolutionService',
        EventAggregator,
        Router,
        ValidationController)
export class DiagramDetail {

  @bindable() public activeDiagram: IDiagram;
  @bindable() public activeSolutionEntry: ISolutionEntry;
  @observable({changeHandler: 'correlationChanged'}) public customCorrelationId: string;
  @observable({changeHandler: 'diagramHasChangedChanged'}) public diagramHasChanged: boolean;
  @bindable({defaultBindingMode: bindingMode.oneWay}) public xml: string;
  public bpmnio: BpmnIo;
  public showUnsavedChangesModal: boolean = false;
  public showSaveForStartModal: boolean = false;
  public showSaveBeforeDeployModal: boolean = false;
  public showStartEventModal: boolean = false;
  public showStartWithOptionsModal: boolean = false;
  public processesStartEvents: Array<DataModels.Events.Event> = [];
  public selectedStartEventId: string;
  public initialToken: string;
  public hasValidationError: boolean = false;
  public diagramIsInvalid: boolean = false;
  public showRemoteSolutionOnDeployModal: boolean = false;
  public remoteSolutions: Array<ISolutionEntry> = [];
  public selectedRemoteSolution: ISolutionEntry;

  private _notificationService: NotificationService;
  private _eventAggregator: EventAggregator;
  private _subscriptions: Array<Subscription>;
  private _router: Router;
  private _validationController: ValidationController;
  private _ipcRenderer: any;
  private _solutionService: ISolutionService;
  private _managementApiClient: IManagementApi;
  private _correlationIdValidationRegExpList: IUserInputValidationRule = {
    alphanumeric: /^[a-z0-9]/i,
    specialCharacters: /^[._ -]/i,
    german: /^[äöüß]/i,
  };
  private _clickedOnCustomStart: boolean = false;

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

  public async getXML(): Promise<string> {
    return this.bpmnio.getXML();
  }

  public attached(): void {
    this.diagramHasChanged = false;

    const isRunningInElectron: boolean = Boolean((window as any).nodeRequire);
    if (isRunningInElectron) {
      this._ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
    }

    this._eventAggregator.publish(environment.events.navBar.showTools);

    this._subscriptions = [
      this._validationController.subscribe((event: ValidateEvent) => {
        this._handleFormValidateEvents(event);
      }),
      this._eventAggregator.subscribe(environment.events.diagramDetail.saveDiagram, () => {
        this.saveDiagram();
      }),
      this._eventAggregator.subscribe(environment.events.diagramDetail.uploadProcess, () => {
        this._checkIfDiagramIsSavedBeforeDeploy();
      }),
      this._eventAggregator.subscribe(environment.events.differsFromOriginal, (savingNeeded: boolean) => {
        this.diagramHasChanged = savingNeeded;
      }),
      this._eventAggregator.subscribe(environment.events.navBar.validationError, () => {
        this.diagramIsInvalid = true;
      }),
      this._eventAggregator.subscribe(environment.events.navBar.noValidationError, () => {
        this.diagramIsInvalid = false;
      }),
      this._eventAggregator.subscribe(environment.events.diagramDetail.startProcess, () => {
        this._showStartDialog();
      }),
      this._eventAggregator.subscribe(environment.events.diagramDetail.startProcessWithOptions, async() => {
        this._clickedOnCustomStart = true;
        await this.showSelectStartEventDialog();
      }),
    ];
  }

  public correlationChanged(newValue: string): void {
    const inputAsCharArray: Array<string> = newValue.split('');

    const correlationIdPassesIdCheck: boolean = !inputAsCharArray.some((letter: string) => {
      for (const regExIndex in this._correlationIdValidationRegExpList) {
        const letterIsInvalid: boolean = letter.match(this._correlationIdValidationRegExpList[regExIndex]) !== null;

        if (letterIsInvalid) {
          return false;
        }
      }

      return true;
    });

    const correlationIdDoesNotStartWithWhitespace: boolean = !newValue.match(/^\s/);
    const correlationIdDoesNotEndWithWhitespace: boolean = !newValue.match(/\s+$/);

    if (correlationIdDoesNotStartWithWhitespace && correlationIdPassesIdCheck && correlationIdDoesNotEndWithWhitespace) {
      this.hasValidationError = false;
    } else {
      this.hasValidationError = true;
    }
  }

  public deactivate(): void {
    this._eventAggregator.publish(environment.events.navBar.hideTools);
    this._eventAggregator.publish(environment.events.navBar.noValidationError);
  }

  public detached(): void {
    for (const subscription of this._subscriptions) {
      subscription.dispose();
    }
  }

  @computedFrom('activeDiagram.uri')
  public get activeDiagramUri(): string {
    return this.activeDiagram.uri;
  }

  /**
   * Saves the current diagram to disk and deploys it to the
   * process engine.
   */
  public async saveDiagramAndDeploy(): Promise<void> {
    this.showSaveBeforeDeployModal = false;
    await this.saveDiagram();

    this._checkForMultipleRemoteSolutions();
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
  public async uploadProcess(solutionToDeployTo: ISolutionEntry): Promise<void> {
    this.cancelDialog();
    const rootElements: Array<IModdleElement> = this.bpmnio.modeler._definitions.rootElements;

    const processModel: IModdleElement = rootElements.find((definition: IModdleElement) => {
      return definition.$type === 'bpmn:Process';
    });
    const processModelId: string = processModel.id;

    try {
      this.activeSolutionEntry = solutionToDeployTo;

      this.activeDiagram.id = processModelId;

      const bpmnFileSuffix: string = '.bpmn';
      const removeBPMNSuffix: (filename: string) => string = (filename: string): string => {
        if (filename.endsWith(bpmnFileSuffix)) {
          return filename.slice(0, bpmnFileSuffix.length);
        }

        return filename;
      };

      const copyOfDiagram: IDiagram = {
        id: this.activeDiagram.id,
        name: this.activeDiagram.name,
        uri: removeBPMNSuffix(this.activeDiagram.uri),
        xml: this.activeDiagram.xml,
      };

      await this.activeSolutionEntry.service.saveDiagram(copyOfDiagram, solutionToDeployTo.uri);

      this.activeDiagram = await this.activeSolutionEntry.service.loadDiagram(processModelId);

      this._router.navigateToRoute('design', {
        diagramName: this.activeDiagram.name,
        solutionUri: this.activeSolutionEntry.uri,
      });

      this._notificationService
          .showNotification(NotificationType.SUCCESS, 'Diagram was successfully uploaded to the connected ProcessEngine.');

      this._eventAggregator.publish(environment.events.diagramDetail.onDiagramDeployed, processModelId);

    } catch (error) {
      this._notificationService
          .showNotification(NotificationType.ERROR, `Unable to update diagram: ${error}.`);
    }
  }

  public diagramHasChangedChanged(): void {
    const isRunningInElectron: boolean = this._ipcRenderer !== undefined;
    if (isRunningInElectron) {
      const canNotClose: boolean = this.diagramHasChanged;

      this._ipcRenderer.send('can-not-close', canNotClose);
    }
  }

  public async setOptionsAndStart(): Promise<void> {

    if (this.hasValidationError) {
      return;
    }

    if (this.diagramHasChanged) {
      await this.saveDiagram();
    }

    const parsedInitialToken: any = this._getInitialTokenValues(this.initialToken);

    await this.startProcess(parsedInitialToken);
  }

  public async startProcess(parsedInitialToken?: any): Promise<void> {

    if (this.selectedStartEventId === null) {
      return;
    }

    this._dropInvalidFormData();

    const startRequestPayload: DataModels.ProcessModels.ProcessStartRequestPayload = {
      inputValues: parsedInitialToken,
      correlationId: this.customCorrelationId,
    };

    try {
      const response: DataModels.ProcessModels.ProcessStartResponsePayload = await this._managementApiClient
        .startProcessInstance(this.activeSolutionEntry.identity,
                              this.activeDiagram.id,
                              this.selectedStartEventId,
                              startRequestPayload,
                              undefined,
                              undefined);

      const {correlationId, processInstanceId} = response;

      this._router.navigateToRoute('live-execution-tracker', {
        diagramName: this.activeDiagram.id,
        solutionUri: this.activeSolutionEntry.uri,
        correlationId: correlationId,
        processInstanceId: processInstanceId,
      });
    } catch (error) {
      this.
        _notificationService
        .showNotification(
          NotificationType.ERROR,
          error.message,
        );
    }

    this._clickedOnCustomStart = false;

  }

  public async saveChangesBeforeStart(): Promise<void> {
    this.showSaveForStartModal = false;

    await this.saveDiagram();
    await this.showSelectStartEventDialog();
  }

  /**
   * Saves the current diagram.
   */
  public async saveDiagram(): Promise<void> {

    const targetIsProcessEngine: boolean = this.activeSolutionEntry.uri.startsWith('http');

    if (this.diagramIsInvalid && targetIsProcessEngine) {
      // TODO: Try to get some more information out of this: Why was it invalid? This message is not very helpful to the user.
      this._notificationService.showNotification(NotificationType.WARNING, `The diagram could not be saved because it is invalid!`);

      return;
    }

    try {
      const xml: string = await this.bpmnio.getXML();
      this.activeDiagram.xml = xml;

      await this.activeSolutionEntry.service.saveDiagram(this.activeDiagram);
      this.bpmnio.saveCurrentXML();

      this.diagramHasChanged = false;
      this._notificationService
          .showNotification(NotificationType.SUCCESS, `File saved!`);
      this._eventAggregator.publish(environment.events.navBar.diagramChangesResolved);
    } catch (error) {
      this._notificationService
          .showNotification(NotificationType.ERROR, `Unable to save the file: ${error}.`);
      throw error;
    }
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

      this.continueStarting();

      return;
    }

    this.showStartEventModal = true;
    this.showSaveForStartModal = false;
  }

  public continueStarting(): void {
    const functionCallDoesNotComeFromCustomModal: boolean = this._clickedOnCustomStart === false;
    if (functionCallDoesNotComeFromCustomModal) {
      this.startProcess();
      this._clickedOnCustomStart = false;
    } else {
      this.showCustomStartModal();
    }

    this.showStartEventModal = false;
  }

  public cancelDialog(): void {
    this.showSaveForStartModal = false;
    this.showStartEventModal = false;
    this.showStartWithOptionsModal = false;
    this.showRemoteSolutionOnDeployModal = false;
    this._clickedOnCustomStart = false;
  }

  public showCustomStartModal(): void {
    this._getTokenFromStartEventAnnotation();
    this.showStartWithOptionsModal = true;
  }

  private _getInitialTokenValues(token: any): any {
    try {
      // If successful, the token is an object
      return JSON.parse(token);
    } catch (error) {
      // If an error occurs, the token is something else.
      return token;
    }
  }

  private _getTokenFromStartEventAnnotation(): void {

    const elementRegistry: IElementRegistry = this.bpmnio.modeler.get('elementRegistry');
    const noStartEventId: boolean = this.selectedStartEventId === undefined;
    let startEvent: IShape;

    if (noStartEventId) {
      startEvent = elementRegistry.filter((element: IShape) => {
        return element.type === 'bpmn:StartEvent';
      })[0];
    } else {
      startEvent = elementRegistry.get(this.selectedStartEventId);
    }

    const startEventAssociations: Array<IConnection> = startEvent.outgoing.filter((connection: IConnection) => {
      const connectionIsAssociation: boolean = connection.type === 'bpmn:Association';

      return connectionIsAssociation;
    });

    const associationWithStartToken: IConnection = startEventAssociations.find((connection: IConnection) => {
      const associationText: string = connection.target.businessObject.text;

      const associationTextIsEmpty: boolean = associationText === undefined
                                           || associationText === null;
      if (associationTextIsEmpty) {
        return undefined;
      }

      const token: string = associationText.trim();

      return token.startsWith('StartToken:');
    });

    const associationWithStartTokenIsExisting: boolean = associationWithStartToken !== undefined;
    if (associationWithStartTokenIsExisting) {
      const untrimmedInitialToken: string = associationWithStartToken.target.businessObject.text;

      const untrimmedInitialTokenIsUndefined: boolean = untrimmedInitialToken === undefined;
      if (untrimmedInitialTokenIsUndefined) {
        this.initialToken = '';

        return;
      }

      const initialToken: string = untrimmedInitialToken
                                    .replace('StartToken:', '')
                                    .trim();

       /**
       * This Regex replaces all single quotes with double quotes and adds double
       * quotes to non quotet keys.
       * This way we make sure that JSON.parse() can handle the given string.
       */
      this.initialToken = initialToken.replace(/(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9]+)(['"])?:/g, '$1"$3":');

      return;
    }

    this.initialToken = '';
  }

  private async _updateProcessStartEvents(): Promise<void> {
    const startEventResponse: DataModels.Events.EventList = await this._managementApiClient
      .getStartEventsForProcessModel(this.activeSolutionEntry.identity, this.activeDiagram.id);

    this.processesStartEvents = startEventResponse.events;
  }

  /**
   * Checks, if the diagram is saved before it can be deployed.
   *
   * If not, the user will be ask to save the diagram.
   */
  private async _checkIfDiagramIsSavedBeforeDeploy(): Promise<void> {
    if (this.diagramHasChanged) {
      this.showSaveBeforeDeployModal = true;
    } else {
      await this._checkForMultipleRemoteSolutions();
    }
  }

  private async _checkForMultipleRemoteSolutions(): Promise<void> {
    this.remoteSolutions = this._solutionService.getRemoteSolutionEntries();

    const multipleRemoteSolutionsConnected: boolean = this.remoteSolutions.length > 1;
    if (multipleRemoteSolutionsConnected) {
      this.showRemoteSolutionOnDeployModal = true;
    } else {
      await this.uploadProcess(this.remoteSolutions[0]);
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

    this.diagramHasChanged
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
        this.diagramIsInvalid = true;

        return;
      }
    }

    this._eventAggregator
      .publish(environment.events.navBar.noValidationError);
    this.diagramIsInvalid = false;
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
}
