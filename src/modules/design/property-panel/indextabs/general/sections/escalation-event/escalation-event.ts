/* eslint-disable no-underscore-dangle */
import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {
  IEscalation,
  IEscalationEventDefinition,
  IEscalationEventElement,
  IEventElement,
  IModdleElement,
  IShape,
} from '@process-engine/bpmn-elements_contracts';

import {IBpmnModdle, IBpmnModeler, IElementRegistry, IPageModel, ISection} from '../../../../../../../contracts';

import environment from '../../../../../../../environment';
import {generateRandomId} from '../../../../../../../services/generate-random-id-module/generate-random-id-module';

@inject(EventAggregator)
export class EscalationEventSection implements ISection {
  public path: string = '/sections/escalation-event/escalation-event';
  public canHandleElement: boolean = false;
  public escalations: Array<IEscalation>;
  public selectedId: string;
  public selectedEscalation: IEscalation;
  public escalationCodeVariable: string;

  private businessObjInPanel: IEscalationEventElement;
  private moddle: IBpmnModdle;
  private modeler: IBpmnModeler;
  private isBoundaryEvent: boolean = true;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    this.businessObjInPanel = model.elementInPanel.businessObject as IEscalationEventElement;

    this.moddle = model.modeler.get('moddle');
    this.modeler = model.modeler;
    this.escalations = await this.getEscalations();

    this.init();
  }

  public isSuitableForElement(element: IShape): boolean {
    if (this.elementIsEscalationEvent(element)) {
      this.isBoundaryEvent = this.elementIsBoundaryEvent(element);
      return true;
    }
    return false;
  }

  public updateEscalation(): void {
    if (this.selectedId === undefined || this.selectedId === null) {
      this.selectedEscalation = null;

      return;
    }

    this.selectedEscalation = this.escalations.find((escalation: IModdleElement) => {
      return escalation.id === this.selectedId;
    });

    const escalationEventDefinition: IEscalationEventDefinition = this.businessObjInPanel.eventDefinitions[0];

    this.escalationCodeVariable = escalationEventDefinition.escalationCodeVariable;
    escalationEventDefinition.escalationRef = this.selectedEscalation;
    this.publishDiagramChange();
  }

  public updateEscalationName(): void {
    const selectedEscalation: IEscalation = this.getSelectedEscalation();
    selectedEscalation.name = this.selectedEscalation.name;
    this.publishDiagramChange();
  }

  public updateEscalationCode(): void {
    const selectedEscalation: IEscalation = this.getSelectedEscalation();
    selectedEscalation.escalationCode = this.selectedEscalation.escalationCode;
    this.publishDiagramChange();
  }

  public updateEscalationCodeVariable(): void {
    const escalationEventDefinition: IEscalationEventDefinition = this.businessObjInPanel.eventDefinitions[0];
    escalationEventDefinition.escalationCodeVariable = this.escalationCodeVariable;
    this.publishDiagramChange();
  }

  public async addEscalation(): Promise<void> {
    const bpmnEscalationProperty: {id: string; name: string} = {
      id: `Escalation_${generateRandomId()}`,
      name: 'Escalation Name',
    };
    const bpmnEscalation: IEscalation = this.moddle.create('bpmn:Escalation', bpmnEscalationProperty);

    this.modeler._definitions.rootElements.push(bpmnEscalation);

    const {xml: xmlStrUpdated} = await this.moddle.toXML(this.modeler._definitions.rootElements);
    await this.modeler.importXML(xmlStrUpdated);
    await this.refreshEscalations();
    await this.setBusinessObject();
    this.selectedId = bpmnEscalation.id;
    this.selectedEscalation = bpmnEscalation;
    this.updateEscalation();

    this.publishDiagramChange();
  }

  public removeSelectedEscalation(): void {
    const noEscalationIsSelected: boolean = !this.selectedId;
    if (noEscalationIsSelected) {
      return;
    }

    const escalationIndex: number = this.escalations.findIndex((escalation: IEscalation) => {
      return escalation.id === this.selectedId;
    });

    this.escalations.splice(escalationIndex, 1);
    this.modeler._definitions.rootElements.splice(this.getRootElementsIndex(this.selectedId), 1);

    this.updateEscalation();
    this.publishDiagramChange();
  }

  private getRootElementsIndex(elementId: string): number {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;

    const rootElementsIndex: number = rootElements.findIndex((element: IModdleElement) => {
      return element.id === elementId;
    });

    return rootElementsIndex;
  }

  private async refreshEscalations(): Promise<void> {
    this.escalations = await this.getEscalations();
  }

  private setBusinessObject(): void {
    const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');
    const elementInPanel: IShape = elementRegistry.get(this.businessObjInPanel.id);
    this.businessObjInPanel = elementInPanel.businessObject as IEscalationEventElement;
  }

  private elementIsEscalationEvent(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element === undefined || element.businessObject === undefined;
    if (elementHasNoBusinessObject) {
      return false;
    }

    const eventElement: IEventElement = element.businessObject as IEventElement;

    const elementIsEscalationEvent: boolean =
      eventElement.eventDefinitions !== undefined &&
      eventElement.eventDefinitions[0] !== undefined &&
      eventElement.eventDefinitions[0].$type === 'bpmn:EscalationEventDefinition';

    return elementIsEscalationEvent;
  }

  private elementIsBoundaryEvent(element: IShape): boolean {
    return (
      element !== undefined &&
      element.businessObject !== undefined &&
      element.businessObject.$type === 'bpmn:BoundaryEvent'
    );
  }

  private init(): void {
    const eventDefinitions: Array<IEscalationEventDefinition> = this.businessObjInPanel.eventDefinitions;
    const businessObjectHasNoEscalationEvents: boolean =
      eventDefinitions === undefined ||
      eventDefinitions === null ||
      eventDefinitions[0].$type !== 'bpmn:EscalationEventDefinition';

    if (businessObjectHasNoEscalationEvents) {
      return;
    }

    const escalationEventDefinition: IEscalationEventDefinition = this.businessObjInPanel.eventDefinitions[0];
    const elementHasNoEscalationRef: boolean = escalationEventDefinition.escalationRef === undefined;

    if (elementHasNoEscalationRef) {
      this.selectedEscalation = null;
      this.selectedId = null;

      return;
    }

    const escalationId: string = escalationEventDefinition.escalationRef.id;
    const elementReferencesEscalation: boolean = this.getEscalationsById(escalationId) !== undefined;

    if (elementReferencesEscalation) {
      this.selectedId = escalationId;

      this.selectedEscalation = this.escalations.find((escalation: IEscalation) => {
        return escalation.id === this.selectedId;
      });
    } else {
      this.selectedEscalation = null;
      this.selectedId = null;
    }
  }

  private getEscalationsById(escalationId: string): IEscalation {
    const escalations: Array<IEscalation> = this.getEscalations();
    const escalation: IEscalation = escalations.find((escalationElement: IEscalation) => {
      return escalationElement.id === escalationId;
    });

    return escalation;
  }

  private getEscalations(): Array<IEscalation> {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;
    const escalations: Array<IEscalation> = rootElements.filter((element: IModdleElement) => {
      return element.$type === 'bpmn:Escalation';
    });

    return escalations;
  }

  private getSelectedEscalation(): IEscalation {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;
    const selectedEscalation: IEscalation = rootElements.find((element: IModdleElement) => {
      const isSelectedEscalation: boolean = element.$type === 'bpmn:Escalation' && element.id === this.selectedId;

      return isSelectedEscalation;
    });

    return selectedEscalation;
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
