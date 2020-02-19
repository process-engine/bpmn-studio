import {EventAggregator, Subscription} from 'aurelia-event-aggregator';
import {bindable, bindingMode, computedFrom, inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';
import {ValidateEvent, ValidationController} from 'aurelia-validation';

import {
  IConnection,
  IExtensionElement,
  IFormElement,
  IModdleElement,
  IShape,
} from '@process-engine/bpmn-elements_contracts';

import {DataModels} from '@process-engine/management_api_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {
  DeployResult,
  IElementRegistry,
  ISolutionEntry,
  IUserInputValidationRule,
  NotificationType,
} from '../../../contracts/index';

import environment from '../../../environment';
import {NotificationService} from '../../../services/notification-service/notification.service';
import {BpmnIo} from '../bpmn-io/bpmn-io';
import {DeployDiagramService} from '../../../services/deploy-diagram-service/deploy-diagram.service';
import {SaveDiagramService} from '../../../services/save-diagram-service/save-diagram.service';
import {exposeFunctionForTesting} from '../../../services/expose-functionality-module/expose-functionality.module';
import {DiagramDetailService} from './service/diagram-detail.service';
import {isRunningInElectron} from '../../../services/is-running-in-electron-module/is-running-in-electron.module';

@inject(
  'DiagramDetailService',
  'NotificationService',
  EventAggregator,
  Router,
  ValidationController,
  DeployDiagramService,
  SaveDiagramService,
)
export class DiagramDetail {
  @bindable() public activeDiagram: IDiagram;
  @bindable() public activeSolutionEntry: ISolutionEntry;
  @observable({changeHandler: 'correlationChanged'}) public customCorrelationId: string;
  @observable({changeHandler: 'diagramHasChangedChanged'}) public diagramHasChanged: boolean;
  @bindable({defaultBindingMode: bindingMode.oneWay}) public xml: string;
  @bindable() public initialToken: string;
  public bpmnio: BpmnIo;
  public showSaveForStartModal: boolean = false;
  public showStartEventModal: boolean = false;
  public showStartWithOptionsModal: boolean = false;
  public processesStartEvents: Array<DataModels.Events.Event> = [];
  public selectedStartEventId: string;
  public hasValidationError: boolean = false;
  public diagramIsInvalid: boolean = false;
  public showRemoteSolutionOnDeployModal: boolean = false;
  public remoteSolutions: Array<ISolutionEntry> = [];
  @observable public selectedRemoteSolution: ISolutionEntry;
  public showDiagramExistingModal: boolean = false;

  private diagramDetailService: DiagramDetailService;
  private notificationService: NotificationService;
  private eventAggregator: EventAggregator;
  private subscriptions: Array<Subscription>;
  private router: Router;
  private validationController: ValidationController;
  private ipcRenderer: any;
  private correlationIdValidationRegExpList: IUserInputValidationRule = {
    alphanumeric: /^[a-z0-9]/i,
    specialCharacters: /^[._ -]/i,
    german: /^[äöüß]/i,
  };

  private clickedOnCustomStart: boolean = false;
  private deployDiagramService: DeployDiagramService;
  private saveDiagramService: SaveDiagramService;

  constructor(
    diagramDetailService: DiagramDetailService,
    notificationService: NotificationService,
    eventAggregator: EventAggregator,
    router: Router,
    validationController: ValidationController,
    deployDiagramService: DeployDiagramService,
    saveDiagramService: SaveDiagramService,
  ) {
    this.diagramDetailService = diagramDetailService;
    this.notificationService = notificationService;
    this.eventAggregator = eventAggregator;
    this.router = router;
    this.validationController = validationController;
    this.deployDiagramService = deployDiagramService;
    this.saveDiagramService = saveDiagramService;

    exposeFunctionForTesting('saveDiagramAs', (path: string): void => {
      this.saveDiagramAs(path);
    });
  }

  public determineActivationStrategy(): string {
    return 'replace';
  }

  public async getXML(): Promise<string> {
    return this.bpmnio.getXML();
  }

  public attached(): void {
    this.diagramHasChanged = false;

    this.selectedRemoteSolution = this.getPreviouslySelectedRemoteSolution();

    if (isRunningInElectron()) {
      this.ipcRenderer = (window as any).nodeRequire('electron').ipcRenderer;
      this.ipcRenderer.on('menubar__start_save_diagram_as', this.electronOnSaveDiagramAs);
      this.ipcRenderer.on('menubar__start_save_diagram', this.electronOnSaveDiagram);
    }

    this.subscriptions = [
      this.validationController.subscribe((event: ValidateEvent) => {
        this.handleFormValidateEvents(event);
      }),
      this.eventAggregator.subscribe(environment.events.diagramDetail.saveDiagram, async () => {
        try {
          await this.saveDiagram();
        } catch (error) {
          if (error.message === 'No path was selected.') {
            return;
          }

          throw error;
        }

        this.eventAggregator.publish(environment.events.diagramDetail.saveDiagramDone);
      }),
      this.eventAggregator.subscribe(environment.events.diagramDetail.uploadProcess, () => {
        this.deployDiagram();
      }),
      this.eventAggregator.subscribe(environment.events.differsFromOriginal, (savingNeeded: boolean) => {
        this.diagramHasChanged = savingNeeded;
      }),
      this.eventAggregator.subscribe(environment.events.navBar.validationError, () => {
        this.diagramIsInvalid = true;
      }),
      this.eventAggregator.subscribe(environment.events.navBar.noValidationError, () => {
        this.diagramIsInvalid = false;
      }),
      this.eventAggregator.subscribe(environment.events.diagramDetail.startProcess, () => {
        this.showStartDialog();
      }),
      this.eventAggregator.subscribe(environment.events.diagramDetail.startProcessWithOptions, async () => {
        this.clickedOnCustomStart = true;
        await this.showSelectStartEventDialog();
      }),
      this.eventAggregator.subscribe(environment.events.diagramDetail.saveDiagramAs, () => {
        this.electronOnSaveDiagramAs();
      }),
      this.eventAggregator.subscribe(environment.events.diagramChangedOutsideTheStudio, (diagramUri: string) => {
        const changedDiagramIsActiveDiagram: boolean = diagramUri === this.activeDiagramUri;

        if (changedDiagramIsActiveDiagram) {
          this.eventAggregator.publish(environment.events.differsFromOriginal, true);
        }
      }),
    ];
  }

  public selectedRemoteSolutionChanged(): void {
    const selectedRemoteSolutionAsString: string = JSON.stringify(this.selectedRemoteSolution);

    localStorage.setItem('selectedRemoteSolution', selectedRemoteSolutionAsString);
  }

  public correlationChanged(newValue: string): void {
    const inputAsCharArray: Array<string> = newValue.split('');

    const correlationIdPassesIdCheck: boolean = !inputAsCharArray.some((letter: string) => {
      return Object.values(this.correlationIdValidationRegExpList).forEach((regEx: RegExp, index: number) => {
        const letterIsInvalid: boolean = letter.match(this.correlationIdValidationRegExpList[index]) !== null;

        if (letterIsInvalid) {
          return false;
        }

        return true;
      });
    });

    const correlationIdDoesNotStartWithWhitespace: boolean = !newValue.match(/^\s/);
    const correlationIdDoesNotEndWithWhitespace: boolean = !newValue.match(/\s+$/);

    if (
      correlationIdDoesNotStartWithWhitespace &&
      correlationIdPassesIdCheck &&
      correlationIdDoesNotEndWithWhitespace
    ) {
      this.hasValidationError = false;
    } else {
      this.hasValidationError = true;
    }
  }

  public detached(): void {
    if (isRunningInElectron()) {
      this.ipcRenderer.removeListener('menubar__start_save_diagram', this.electronOnSaveDiagram);
      this.ipcRenderer.removeListener('menubar__start_save_diagram_as', this.electronOnSaveDiagramAs);
    }

    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  @computedFrom('activeDiagram.uri')
  public get activeDiagramUri(): string {
    return this.activeDiagram.uri;
  }

  public async setOptionsAndStart(): Promise<void> {
    if (this.hasValidationError) {
      return;
    }

    if (this.diagramHasChanged) {
      await this.saveDiagram();
    }

    const parsedInitialToken: any = this.getInitialTokenValues(this.initialToken);

    await this.startProcess(parsedInitialToken);
  }

  public async startProcess(parsedInitialToken?: any): Promise<void> {
    if (this.selectedStartEventId === null) {
      return;
    }

    this.dropInvalidFormData();

    this.getTokenFromStartEventAnnotation();
    const defaultToken: any = this.getInitialTokenValues(this.initialToken);
    const startToken = defaultToken === '' ? undefined : defaultToken;

    const startRequestPayload: DataModels.ProcessModels.ProcessStartRequestPayload = {
      inputValues: parsedInitialToken || startToken,
      correlationId: this.customCorrelationId,
    };

    try {
      const useDefaultStartCallbackType: undefined = undefined;

      const response: DataModels.ProcessModels.ProcessStartResponsePayload = await this.diagramDetailService.startProcessInstance(
        this.activeSolutionEntry.identity,
        this.activeDiagram.id,
        startRequestPayload,
        useDefaultStartCallbackType,
        this.selectedStartEventId,
      );

      const {correlationId, processInstanceId} = response;

      this.router.navigateToRoute('live-execution-tracker', {
        diagramName: this.activeDiagram.id,
        solutionUri: this.activeSolutionEntry.uri,
        correlationId: correlationId,
        processInstanceId: processInstanceId,
      });
    } catch (error) {
      this.notificationService.showNotification(NotificationType.ERROR, error.message);
    }

    this.clickedOnCustomStart = false;
  }

  public async saveChangesBeforeStart(): Promise<void> {
    this.showSaveForStartModal = false;

    await this.saveDiagram();
    await this.showSelectStartEventDialog();
  }

  public async saveDiagram(): Promise<void> {
    if (this.diagramIsInvalid) {
      return;
    }

    const xml: string = await this.bpmnio.getXML();

    await this.bpmnio.saveDiagramState(this.activeDiagramUri);

    await this.saveDiagramService.saveDiagram(this.activeSolutionEntry, this.activeDiagram, xml);

    this.bpmnio.saveCurrentXML();
    this.diagramHasChanged = false;
  }

  public async saveDiagramAs(path?: string): Promise<void> {
    if (this.diagramIsInvalid) {
      return;
    }

    const xml: string = await this.getXMLOrDisplayError();

    if (!xml) {
      return;
    }

    await this.saveDiagramService.saveDiagramAs(this.activeSolutionEntry, this.activeDiagram, xml, path);

    this.bpmnio.saveStateForNewUri = true;
    this.bpmnio.saveCurrentXML();

    this.diagramHasChanged = false;
  }

  /**
   * Opens a modal dialog to ask the user, which StartEvent he want's to
   * use to start the process.
   *
   * If there is only one StartEvent this method will select this StartEvent by
   * default.
   */
  public async showSelectStartEventDialog(): Promise<void> {
    await this.updateProcessStartEvents();

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
    const functionCallDoesNotComeFromCustomModal: boolean = this.clickedOnCustomStart === false;
    if (functionCallDoesNotComeFromCustomModal) {
      this.startProcess();
      this.clickedOnCustomStart = false;
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
    this.clickedOnCustomStart = false;
  }

  public showCustomStartModal(): void {
    this.getTokenFromStartEventAnnotation();
    this.showStartWithOptionsModal = true;
  }

  private getPreviouslySelectedRemoteSolution(): ISolutionEntry {
    const selectedRemoteSolutionFromLocalStorage: string = localStorage.getItem('selectedRemoteSolution');

    if (selectedRemoteSolutionFromLocalStorage === null) {
      return undefined;
    }

    return JSON.parse(selectedRemoteSolutionFromLocalStorage);
  }

  private getInitialTokenValues(token: any): any {
    try {
      // If successful, the token is an object
      return JSON.parse(token);
    } catch (error) {
      // If an error occurs, the token is something else.
      return token;
    }
  }

  private async getXMLOrDisplayError(): Promise<string> {
    try {
      return await this.bpmnio.getXML();
    } catch (error) {
      this.notificationService.showNotification(NotificationType.ERROR, `Unable to get the XML: ${error}.`);
      return undefined;
    }
  }

  private getTokenFromStartEventAnnotation(): void {
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

      const associationTextIsEmpty: boolean = associationText === undefined || associationText === null;
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

      const initialToken: string = untrimmedInitialToken.replace('StartToken:', '').trim();

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

  private async updateProcessStartEvents(): Promise<void> {
    const startEventResponse: DataModels.Events.EventList = await this.diagramDetailService.getStartEventsForProcessModel(
      this.activeSolutionEntry.identity,
      this.activeDiagram.id,
    );

    this.processesStartEvents = startEventResponse.events;
  }

  private async deployDiagram(): Promise<void> {
    const xml: string | undefined = this.diagramHasChanged ? await this.bpmnio.getXML() : undefined;

    const deployResult: DeployResult = await this.deployDiagramService.deployDiagram(
      this.activeSolutionEntry,
      this.activeDiagram,
      xml,
    );

    if (deployResult === undefined) {
      return;
    }

    this.router.navigateToRoute('design', {
      diagramName: deployResult.diagram.name,
      solutionUri: deployResult.solution.uri,
    });
  }

  /**
   * Opens a modal, if the diagram has unsaved changes and ask the user,
   * if he wants to save his changes. This is necessary to
   * execute the process.
   *
   * If there are no unsaved changes, no modal will be displayed.
   */
  private async showStartDialog(): Promise<void> {
    if (this.diagramHasChanged) {
      this.showSaveForStartModal = true;
    } else {
      await this.showSelectStartEventDialog();
    }
  }

  private electronOnSaveDiagramAs = async (_?: Event): Promise<void> => {
    await this.saveDiagramAs();
  };

  private electronOnSaveDiagram = async (_?: Event): Promise<void> => {
    this.eventAggregator.publish(environment.events.diagramDetail.saveDiagram);
  };

  private handleFormValidateEvents(event: ValidateEvent): void {
    const eventIsValidateEvent: boolean = event.type !== 'validate';

    if (eventIsValidateEvent) {
      return;
    }

    for (const result of event.results) {
      const resultIsNotValid: boolean = result.valid === false;

      if (resultIsNotValid) {
        this.eventAggregator.publish(environment.events.navBar.validationError);
        this.diagramIsInvalid = true;

        return;
      }
    }

    this.eventAggregator.publish(environment.events.navBar.noValidationError);
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
  private dropInvalidFormData(): void {
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
            const elementContainsFields: boolean = value.fields !== undefined && value.fields.length > 0;

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
