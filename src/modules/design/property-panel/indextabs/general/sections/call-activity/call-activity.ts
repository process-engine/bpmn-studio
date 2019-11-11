import {EventAggregator} from 'aurelia-event-aggregator';
import {inject, observable} from 'aurelia-framework';
import {Router} from 'aurelia-router';

import {
  ICallActivityElement,
  IExtensionElement,
  IModdleElement,
  IPropertiesElement,
  IProperty,
  IShape,
} from '@process-engine/bpmn-elements_contracts';
import {IDiagram} from '@process-engine/solutionexplorer.contracts';

import {IBpmnModdle, IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';
import {GeneralService} from '../../service/general.service';

const ProcessIdRegex: RegExp = /(?<=process id=").*?(?=")/;

@inject(GeneralService, Router, EventAggregator)
export class CallActivitySection implements ISection {
  public path: string = '/sections/call-activity/call-activity';
  public canHandleElement: boolean = false;
  public allDiagrams: Array<IDiagram>;
  public startEvents: Array<IShape>;
  public previouslySelectedDiagram: string;
  public selectedDiagramName: string;
  @observable public selectedStartEvent: string;
  @observable public payload: string;
  public payloadInput: HTMLTextAreaElement;

  private businessObjInPanel: ICallActivityElement;
  private generalService: GeneralService;
  private router: Router;
  private eventAggregator: EventAggregator;
  private activeSolutionUri: string;
  private moddle: IBpmnModdle;

  constructor(generalService?: GeneralService, router?: Router, eventAggregator?: EventAggregator) {
    this.generalService = generalService;
    this.router = router;
    this.eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    this.moddle = model.modeler.get('moddle');
    this.activeSolutionUri = this.router.currentInstruction.queryParams.solutionUri;
    this.businessObjInPanel = model.elementInPanel.businessObject;

    await this.getAllDiagrams();

    this.previouslySelectedDiagram = this.businessObjInPanel.calledElement;
    this.selectedDiagramName = this.businessObjInPanel.calledElement;

    if (this.selectedDiagramName) {
      try {
        this.startEvents = await this.generalService.getAllStartEventsForDiagram(this.selectedDiagramName);
      } catch (error) {
        this.startEvents = [];
      }

      this.selectedStartEvent = this.getSelectedStartEvent();

      if (this.selectedStartEvent === undefined && this.startEvents.length > 0) {
        this.selectedStartEvent = this.startEvents[0].id;
      }

      this.payload = this.getPayload();
    }
  }

  public attached(): void {
    this.recoverInputHeight();

    this.saveInputHeightOnChange();
  }

  public detached(): void {
    this.payloadInput.removeEventListener('mousedown', this.saveInputHeightOnMouseUp);
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementIsCallActivity: boolean =
      element !== undefined &&
      element.businessObject !== undefined &&
      element.businessObject.$type === 'bpmn:CallActivity';

    return elementIsCallActivity;
  }

  public navigateToCalledDiagram(): void {
    this.router.navigateToRoute('design', {
      diagramName: this.selectedDiagramName,
      solutionUri: this.activeSolutionUri,
      view: 'detail',
    });
  }

  public isPartOfAllDiagrams(diagramName: string): boolean {
    return this.allDiagrams.some((diagram: IDiagram): boolean => {
      return diagram.name === diagramName;
    });
  }

  public selectedStartEventChanged(newValue, oldValue): void {
    if (newValue === undefined || oldValue === undefined) {
      return;
    }

    this.publishDiagramChange();

    const noExtensionsElements =
      this.businessObjInPanel.extensionElements === undefined ||
      this.businessObjInPanel.extensionElements.values === undefined ||
      this.businessObjInPanel.extensionElements.values.length === 0;

    if (noExtensionsElements) {
      this.createExtensionElement();
    }

    const bpmnPropertyProperties: object = {
      name: 'startEventId',
      value: newValue,
    };
    const bpmnProperty: IProperty = this.moddle.create('camunda:Property', bpmnPropertyProperties);

    let propertiesElement = this.getPropertiesElement();

    const propertiesElementDoesNotExist: boolean = propertiesElement === undefined;

    if (propertiesElementDoesNotExist) {
      this.createPropertiesElement();

      propertiesElement = this.getPropertiesElement();
    }

    const startEventProperty = propertiesElement.values.findIndex((value: IProperty) => value.name === 'startEventId');

    if (startEventProperty >= 0) {
      propertiesElement.values.splice(startEventProperty, 1);
    }

    if (newValue === undefined || newValue.trim() === '') {
      return;
    }

    propertiesElement.values.push(bpmnProperty);
  }

  public async payloadChanged(newValue, oldValue): Promise<void> {
    if (!newValue.trim() && !oldValue.trim()) {
      return;
    }
    this.publishDiagramChange();

    const propertiesElement = this.getPropertiesElement();
    const payloadProperty = propertiesElement.values.findIndex((value: IProperty) => value.name === 'payload');

    if (!newValue.trim()) {
      propertiesElement.values.splice(payloadProperty, 1);

      return;
    }

    const bpmnPropertyProperties: object = {
      name: 'payload',
      value: newValue,
    };
    const bpmnProperty: IProperty = this.moddle.create('camunda:Property', bpmnPropertyProperties);

    if (payloadProperty >= 0) {
      propertiesElement.values.splice(payloadProperty, 1);
    }

    propertiesElement.values.push(bpmnProperty);
  }

  public async updateCalledDiagram(): Promise<void> {
    try {
      this.startEvents = await this.generalService.getAllStartEventsForDiagram(this.selectedDiagramName);
    } catch (error) {
      this.startEvents = [];
    }

    this.businessObjInPanel.calledElement = this.selectedDiagramName;

    this.publishDiagramChange();
  }

  public getProcessIdByDiagramName(diagramName: string): string {
    const diagram: IDiagram = this.getDiagramByName(diagramName);

    const processId: string = diagram.xml.match(ProcessIdRegex)[0];

    return processId;
  }

  private getDiagramByName(name: string): IDiagram {
    return this.allDiagrams.find((diagram: IDiagram): boolean => {
      return diagram.name === name;
    });
  }

  private getPropertiesElement(): IPropertiesElement {
    const propertiesElement: IPropertiesElement = this.businessObjInPanel.extensionElements.values.find(
      (extensionValue: IExtensionElement) => {
        if (!extensionValue) {
          return undefined;
        }

        const extensionIsPropertiesElement: boolean =
          extensionValue.$type === 'camunda:Properties' &&
          extensionValue.values !== undefined &&
          extensionValue.values !== null;

        return extensionIsPropertiesElement;
      },
    );

    return propertiesElement;
  }

  private createExtensionElement(): void {
    const extensionValues: Array<IModdleElement> = [];
    const properties: Array<IProperty> = [];
    const propertiesElement: IPropertiesElement = this.moddle.create('camunda:Properties', {values: properties});
    extensionValues.push(propertiesElement);

    const extensionElements: IModdleElement = this.moddle.create('bpmn:ExtensionElements', {
      values: extensionValues,
    });
    this.businessObjInPanel.extensionElements = extensionElements;
  }

  private createPropertiesElement(): void {
    const properties: Array<IProperty> = [];
    const propertiesElement: IPropertiesElement = this.moddle.create('camunda:Properties', {values: properties});

    const extensionElementValuesExists: boolean = this.businessObjInPanel.extensionElements.values !== undefined;

    if (extensionElementValuesExists) {
      this.businessObjInPanel.extensionElements.values.push(propertiesElement);
    } else {
      this.businessObjInPanel.extensionElements.values = [propertiesElement];
    }
  }

  private getSelectedStartEvent(): string | undefined {
    const extensionElementAndPropertiesExist =
      this.businessObjInPanel.extensionElements !== undefined &&
      this.businessObjInPanel.extensionElements.values !== undefined &&
      this.businessObjInPanel.extensionElements.values.length !== 0;

    if (!extensionElementAndPropertiesExist) {
      return undefined;
    }

    const propertiesElement = this.getPropertiesElement();

    const propertiesElementExists: boolean = propertiesElement !== undefined;
    if (!propertiesElementExists) {
      return undefined;
    }

    const startEventIdProperty: IProperty = propertiesElement.values.find(
      (value: IPropertiesElement) => value.name === 'startEventId',
    );

    const startEventIdIsConfigured: boolean = startEventIdProperty !== undefined;

    return startEventIdIsConfigured ? startEventIdProperty.value : undefined;
  }

  private getPayload(): string | undefined {
    const extensionElementAndPropertiesExist =
      this.businessObjInPanel.extensionElements !== undefined &&
      this.businessObjInPanel.extensionElements.values !== undefined &&
      this.businessObjInPanel.extensionElements.values.length !== 0;

    if (!extensionElementAndPropertiesExist) {
      return undefined;
    }

    const propertiesElement = this.getPropertiesElement();

    const propertiesElementExists: boolean = propertiesElement !== undefined;
    if (!propertiesElementExists) {
      return undefined;
    }

    const payloadProperty = propertiesElement.values.find((value: IPropertiesElement) => value.name === 'payload');
    return payloadProperty ? payloadProperty.value : undefined;
  }

  private async getAllDiagrams(): Promise<void> {
    const allDiagramsInSolution: Array<IDiagram> = await this.generalService.getAllDiagrams();

    const currentDiagramName: string = this.router.currentInstruction.params.diagramName;
    const allDiagramWithoutCurrentOne: Array<IDiagram> = allDiagramsInSolution.filter((diagram: IDiagram) => {
      return diagram.name !== currentDiagramName;
    });

    this.allDiagrams = allDiagramWithoutCurrentOne;
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }

  private saveInputHeightOnChange(): void {
    this.payloadInput.addEventListener('mousedown', this.saveInputHeightOnMouseUp);
  }

  private recoverInputHeight(): void {
    const persistedInputHeight: string = localStorage.getItem('scriptTaskInputHeight');

    if (persistedInputHeight) {
      this.payloadInput.style.height = `${persistedInputHeight}px`;
    }
  }

  private saveInputHeightOnMouseUp: EventListenerOrEventListenerObject = () => {
    const resizeListenerFunction: EventListenerOrEventListenerObject = (): void => {
      localStorage.setItem('scriptTaskInputHeight', this.payloadInput.clientHeight.toString());
      window.removeEventListener('mouseup', resizeListenerFunction);
    };
    window.addEventListener('mouseup', resizeListenerFunction);
  };
}
