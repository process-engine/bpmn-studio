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

import {IBpmnModdle, IEventFunction, IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';
import {GeneralService} from '../../service/general.service';

const ProcessIdRegex: RegExp = /(?<=process id=").*?(?=")/;

type DiagramNameWithProcessId = {
  diagramName: string;
  processId: string;
};

type StartEventIdWithDiagramName = {
  diagramName: string;
  startEventId: string;
};

@inject(GeneralService, Router, EventAggregator)
export class CallActivitySection implements ISection {
  public path: string = '/sections/call-activity/call-activity';
  public canHandleElement: boolean = false;
  @observable public allDiagrams: Array<IDiagram>;
  public startEventIdsWithDiagramNames: Array<StartEventIdWithDiagramName>;
  public previouslySelectedDiagram: string;
  public selectedProcessId: string;
  @observable public selectedStartEvent: string;
  @observable public payload: string;
  public payloadInput: HTMLTextAreaElement;
  public diagramNamesWithProcessIds: Array<DiagramNameWithProcessId> = [];
  public showPayloadModal: boolean;

  public callActivitySection: CallActivitySection = this;

  public showChooseDiagramModal: boolean;
  public diagramNamesToSelectFrom: Array<string>;
  public selectedDiagramName: string;

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
    this.selectedProcessId = this.businessObjInPanel.calledElement;

    const processIdIsSelected: boolean = this.selectedProcessId !== undefined;
    if (processIdIsSelected) {
      try {
        this.startEventIdsWithDiagramNames = await this.getAllStartEventsForProcessId(this.selectedProcessId);
      } catch (error) {
        this.startEventIdsWithDiagramNames = [];
      }

      this.selectedStartEvent = this.getSelectedStartEvent();

      if (this.selectedStartEvent === undefined && this.startEventIdsWithDiagramNames.length > 0) {
        this.selectedStartEvent = this.startEventIdsWithDiagramNames[0].startEventId;
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

  public async navigateToCalledDiagram(): Promise<void> {
    const diagramNamesForGivenProcessId: Array<string> = this.getAllDiagramNamesForProcessId(this.selectedProcessId);

    let diagramName: string;

    if (diagramNamesForGivenProcessId.length === 1) {
      diagramName = diagramNamesForGivenProcessId[0];
    } else {
      try {
        diagramName = await this.handleDiagramSelection(diagramNamesForGivenProcessId);
      } catch {
        return;
      }
    }

    this.router.navigateToRoute('design', {
      diagramName: diagramName,
      solutionUri: this.activeSolutionUri,
      view: 'detail',
    });
  }

  public isPartOfAllDiagrams(processId: string): boolean {
    return this.diagramNamesWithProcessIds.some((diagramNameWithProcessId: DiagramNameWithProcessId): boolean => {
      return diagramNameWithProcessId.processId === processId;
    });
  }

  public allDiagramsChanged(): void {
    this.diagramNamesWithProcessIds = this.allDiagrams.map((diagram: IDiagram) => {
      const diagramNameWithProcessId: DiagramNameWithProcessId = {
        diagramName: diagram.name,
        processId: this.getProcessIdByDiagramName(diagram.name),
      };

      return diagramNameWithProcessId;
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
      this.startEventIdsWithDiagramNames = await this.getAllStartEventsForProcessId(this.selectedProcessId);
    } catch (error) {
      this.startEventIdsWithDiagramNames = [];
    }

    this.businessObjInPanel.calledElement = this.selectedProcessId;

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

  private async getAllStartEventsForProcessId(processId: string): Promise<Array<StartEventIdWithDiagramName>> {
    const diagramNamesForGivenProcessId: Array<string> = this.getAllDiagramNamesForProcessId(processId);

    const startEventIdsWithDiagramNames: Array<StartEventIdWithDiagramName> = [];
    for (const diagramName of diagramNamesForGivenProcessId) {
      const startEventsForDiagram: Array<IShape> = await this.generalService.getAllStartEventsForDiagram(diagramName);

      const startEventIdsForDiagramWithDiagramName: Array<StartEventIdWithDiagramName> = startEventsForDiagram.map(
        (startEvent: IShape) => {
          return {
            diagramName: diagramName,
            startEventId: startEvent.id,
          };
        },
      );

      startEventIdsWithDiagramNames.push(...startEventIdsForDiagramWithDiagramName);
    }

    return startEventIdsWithDiagramNames;
  }

  private getAllDiagramNamesForProcessId(processId: string): Array<string> {
    const diagramNamesForGivenProcessId: Array<string> = this.diagramNamesWithProcessIds
      .filter((diagramNameWithProcessId: DiagramNameWithProcessId) => {
        return diagramNameWithProcessId.processId === processId;
      })
      .map((diagramNameWithProcessId: DiagramNameWithProcessId) => {
        return diagramNameWithProcessId.diagramName;
      });

    return diagramNamesForGivenProcessId;
  }

  private async handleDiagramSelection(diagramNames: Array<string>): Promise<string> {
    return new Promise((resolve: Function, reject: Function): void => {
      this.diagramNamesToSelectFrom = diagramNames;

      this.showChooseDiagramModal = true;

      const cancelNavigation: IEventFunction = (): void => {
        this.showChooseDiagramModal = false;

        reject();

        document.getElementById('confirmNavigationModal').removeEventListener('click', confirmNavigation);
      };

      const confirmNavigation: IEventFunction = async (): Promise<void> => {
        this.showChooseDiagramModal = false;

        resolve(this.selectedDiagramName);

        document.getElementById('cancelNavigationModal').removeEventListener('click', cancelNavigation);
      };

      setTimeout(() => {
        document.getElementById('cancelNavigationModal').addEventListener('click', cancelNavigation, {once: true});
        document.getElementById('confirmNavigationModal').addEventListener('click', confirmNavigation, {once: true});
      }, 0);
    });
  }
}
