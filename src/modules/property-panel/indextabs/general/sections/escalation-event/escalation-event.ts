import {
  IBpmnModdle,
  IBpmnModeler,
  IElementRegistry,
  IEscalation,
  IEscalationElement,
  IModdleElement,
  IPageModel,
  ISection,
  IShape,
} from '../../../../../../contracts';

import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import environment from '../../../../../../environment';
import {GeneralService} from '../../service/general.service';

@inject(GeneralService, EventAggregator)
export class EscalationEventSection implements ISection {

  public path: string = '/sections/escalation-event/escalation-event';
  public canHandleElement: boolean = false;
  public escalations: Array<IEscalation>;
  public selectedId: string;
  public selectedEscalation: IEscalation;
  public escalationCodeVariable: string;

  private _businessObjInPanel: IEscalationElement;
  private _moddle: IBpmnModdle;
  private _modeler: IBpmnModeler;
  private _generalService: GeneralService;
  private _isBoundaryEvent: boolean = true;
  private _eventAggregator: EventAggregator;

  constructor(generalService?: GeneralService, eventAggregator?: EventAggregator) {
    this._generalService = generalService;
    this._eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    this._businessObjInPanel = model.elementInPanel.businessObject;

    this._moddle = model.modeler.get('moddle');
    this._modeler = model.modeler;
    this.escalations = await this._getEscalations();

    this._init();
  }

  public isSuitableForElement(element: IShape): boolean {
    if (this._elementIsEscalationEvent(element)) {
      this._isBoundaryEvent = this._elementIsBoundaryEvent(element);
      return true;
    }
    return false;
  }

  public updateEscalation(): void {
    if (this.selectedId === undefined || this.selectedId === null) {
      this.selectedEscalation =  null;

      return;
    }

    this.selectedEscalation = this.escalations.find((escalation: IModdleElement) => {
      return escalation.id === this.selectedId;
    });

    const escalationElement: IEscalationElement = this._businessObjInPanel.eventDefinitions[0];

    this.escalationCodeVariable = escalationElement.escalationCodeVariable;
    escalationElement.escalationRef = this.selectedEscalation;
    this._publishDiagramChange();
  }

  public updateEscalationName(): void {
    const selectedEscalation: IEscalation = this._getSelectedEscalation();
    selectedEscalation.name = this.selectedEscalation.name;
    this._publishDiagramChange();
  }

  public updateEscalationCode(): void {
    const selectedEscalation: IEscalation = this._getSelectedEscalation();
    selectedEscalation.escalationCode = this.selectedEscalation.escalationCode;
    this._publishDiagramChange();
  }

  public updateEscalationCodeVariable(): void {
    const escalationElement: IEscalationElement = this._businessObjInPanel.eventDefinitions[0];
    escalationElement.escalationCodeVariable = this.escalationCodeVariable;
    this._publishDiagramChange();
  }

  public addEscalation(): void {
    const bpmnEscalationProperty: {id: string, name: string} = {
      id: `Escalation_${this._generalService.generateRandomId()}`,
      name: 'Escalation Name',
    };
    const bpmnEscalation: IEscalation = this._moddle.create('bpmn:Escalation', bpmnEscalationProperty);

    this._modeler._definitions.rootElements.push(bpmnEscalation);

    this._moddle.toXML(this._modeler._definitions.rootElements, (toXMLError: Error, xmlStrUpdated: string) => {
      this._modeler.importXML(xmlStrUpdated, async(importXMLError: Error) => {
        await this._refreshEscalations();
        await this._setBusinessObject();
        this.selectedId = bpmnEscalation.id;
        this.selectedEscalation = bpmnEscalation;
        this.updateEscalation();
      });
    });
    this._publishDiagramChange();
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
    this._modeler._definitions.rootElements.splice(this._getRootElementsIndex(this.selectedId), 1);

    this.updateEscalation();
    this._publishDiagramChange();
  }

  private _getRootElementsIndex(elementId: string): number {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;

    const rootElementsIndex: number = rootElements.findIndex((element: IModdleElement) => {
      return element.id === elementId;
    });

    return rootElementsIndex;
  }

  private async _refreshEscalations(): Promise<void> {
    this.escalations = await this._getEscalations();
  }

  private _setBusinessObject(): void {
    const elementRegistry: IElementRegistry = this._modeler.get('elementRegistry');
    const elementInPanel: IShape = elementRegistry.get(this._businessObjInPanel.id);
    this._businessObjInPanel = elementInPanel.businessObject;
  }

  private _elementIsEscalationEvent(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.eventDefinitions !== undefined
        && element.businessObject.eventDefinitions[0] !== undefined
        && element.businessObject.eventDefinitions[0].$type === 'bpmn:EscalationEventDefinition';
  }

  private _elementIsBoundaryEvent(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.$type === 'bpmn:BoundaryEvent';
  }

  private _init(): void {
    const eventDefinitions: Array<IModdleElement> = this._businessObjInPanel.eventDefinitions;
    const businessObjectHasNoEscalationEvents: boolean = eventDefinitions === undefined
                                                      || eventDefinitions === null
                                                      || eventDefinitions[0].$type !== 'bpmn:EscalationEventDefinition';

    if (businessObjectHasNoEscalationEvents) {
      return;
    }

    const escalationElement: IEscalationElement = this._businessObjInPanel.eventDefinitions[0];
    const elementHasNoEscalationRef: boolean = escalationElement.escalationRef === undefined;

    if (elementHasNoEscalationRef) {
      this.selectedEscalation = null;
      this.selectedId = null;

      return;
    }

    const escalationId: string = escalationElement.escalationRef.id;
    const elementReferencesEscalation: boolean = this._getEscalationsById(escalationId) !== undefined;

    if (elementReferencesEscalation) {
      this.selectedId = escalationId;
      this.updateEscalation();
    } else {
      this.selectedEscalation = null;
      this.selectedId = null;
    }
  }

  private _getEscalationsById(escalationId: string): IEscalation {
    const escalations: Array<IEscalation> = this._getEscalations();
    const escalation: IEscalation = escalations.find((escalationElement: IEscalation) => {
      return escalationElement.id === escalationId;
    });

    return escalation;
  }

  private _getEscalations(): Array<IEscalation> {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;
    const escalations: Array<IEscalation> = rootElements.filter((element: IModdleElement) => {
      return element.$type === 'bpmn:Escalation';
    });

    return escalations;
  }

  private _getSelectedEscalation(): IEscalation {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;
    const selectedEscalation: IEscalation = rootElements.find((element: IModdleElement) => {
      const isSelectedEscalation: boolean = element.$type === 'bpmn:Escalation' && element.id === this.selectedId;

      return isSelectedEscalation;
    });

    return selectedEscalation;
  }

  private _publishDiagramChange(): void {
    this._eventAggregator.publish(environment.events.diagramChange);
  }
}
