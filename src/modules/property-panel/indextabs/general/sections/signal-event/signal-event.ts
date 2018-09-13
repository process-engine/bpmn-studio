import {
  IBpmnModdle,
  IBpmnModeler,
  IElementRegistry,
  IModdleElement,
  IPageModel,
  ISection,
  IShape,
  ISignal,
  ISignalElement,
} from '../../../../../../contracts';

import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import environment from '../../../../../../environment';
import {GeneralService} from '../../service/general.service';

@inject(GeneralService, EventAggregator)
export class SignalEventSection implements ISection {

  public path: string = '/sections/signal-event/signal-event';
  public canHandleElement: boolean = false;
  public signals: Array<ISignal>;
  public selectedId: string;
  public selectedSignal: ISignal;

  private _businessObjInPanel: ISignalElement;
  private _moddle: IBpmnModdle;
  private _modeler: IBpmnModeler;
  private _generalService: GeneralService;
  private _eventAggregator: EventAggregator;

  constructor(generalService?: GeneralService, eventAggregator?: EventAggregator) {
    this._generalService = generalService;
    this._eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    this._businessObjInPanel = model.elementInPanel.businessObject;
    this._moddle = model.modeler.get('moddle');
    this._modeler = model.modeler;

    this.signals = await this._getSignals();

    this._init();
  }

  public isSuitableForElement(element: IShape): boolean {
    return this._elementIsSignalEvent(element);
  }

  public updateSignal(): void {
    this.selectedSignal = this.signals.find((signal: ISignal) => {
      return signal.id === this.selectedId;
    });

    const signalElement: ISignalElement = this._businessObjInPanel.eventDefinitions[0];
    signalElement.signalRef = this.selectedSignal;
    this._publishDiagramChange();
  }

  public updateName(): void {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;
    const signal: ISignal = rootElements.find((element: IModdleElement) => {
      const elementIsSelectedSignal: boolean = element.$type === 'bpmn:Signal' && element.id === this.selectedId;
      return elementIsSelectedSignal;
    });

    signal.name = this.selectedSignal.name;
    this._publishDiagramChange();
  }

  public addSignal(): void {
    const bpmnSignalProperty: {id: string, name: string} = {
      id: `Signal_${this._generalService.generateRandomId()}`,
      name: 'Signal Name',
    };
    const bpmnSignal: ISignalElement = this._moddle.create('bpmn:Signal', bpmnSignalProperty);

    this._modeler._definitions.rootElements.push(bpmnSignal);

    this._moddle.toXML(this._modeler._definitions.rootElements, (toXMLError: Error, xmlStrUpdated: string) => {
      this._modeler.importXML(xmlStrUpdated, async(importXMLError: Error) => {
        await this._refreshSignals();
        await this._setBusinessObj();
        this.selectedId = bpmnSignal.id;
        this.selectedSignal = bpmnSignal;
        this.updateSignal();
      });
    });
    this._publishDiagramChange();
  }

  public removeSelectedSignal(): void {
    const noSignalIsSelected: boolean = !this.selectedId;
    if (noSignalIsSelected) {
      return;
    }

    const signalIndex: number = this.signals.findIndex((signal: ISignal) => {
      return signal.id === this.selectedId;
    });

    this.signals.splice(signalIndex, 1);
    this._modeler._definitions.rootElements.splice(this._getRootElementsIndex(this.selectedId), 1);

    this.updateSignal();
    this._publishDiagramChange();
  }

  private _getRootElementsIndex(elementId: string): number {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;

    const rootElementsIndex: number = rootElements.findIndex((element: IModdleElement) => {
      return element.id === elementId;
    });

    return rootElementsIndex;
  }

  private _elementIsSignalEvent(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.eventDefinitions !== undefined
        && element.businessObject.eventDefinitions[0] !== undefined
        && element.businessObject.eventDefinitions[0].$type === 'bpmn:SignalEventDefinition';
  }

  private _init(): void {
    const eventDefinitions: Array<IModdleElement> = this._businessObjInPanel.eventDefinitions;
    const businessObjectHasNoSignalEvents: boolean = eventDefinitions === undefined
                                                  || eventDefinitions === null
                                                  || eventDefinitions[0].$type !== 'bpmn:SignalEventDefinition';
    if (businessObjectHasNoSignalEvents) {
      return;
    }

    const signalElement: ISignalElement = this._businessObjInPanel.eventDefinitions[0];
    const elementHasNoSignalRef: boolean = signalElement.signalRef === undefined;

    if (elementHasNoSignalRef) {
      this.selectedSignal = null;
      this.selectedId = null;

      return;
    }

    const signalId: string = signalElement.signalRef.id;
    const elementReferencesSignal: boolean = this._getSignalById(signalId) !== undefined;

    if (elementReferencesSignal) {
      this.selectedId = signalId;
      this.updateSignal();
    } else {
      this.selectedSignal = null;
      this.selectedId = null;
    }
  }

  private _getSignalById(signalId: string): ISignal {
    const signals: Array<ISignal> = this._getSignals();
    const signal: ISignal = signals.find((signalElement: ISignal) => {
      return signalElement.id === signalId;
    });

    return signal;
  }

  private _getSignals(): Array<ISignal> {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;
    const signals: Array<ISignal> = rootElements.filter((element: IModdleElement) => {
      return element.$type === 'bpmn:Signal';
    });

    return signals;
  }

  private async _refreshSignals(): Promise<void> {
    this.signals = await this._getSignals();
  }

  private _setBusinessObj(): void {
      const elementRegistry: IElementRegistry = this._modeler.get('elementRegistry');
      const elementInPanel: IShape = elementRegistry.get(this._businessObjInPanel.id);
      this._businessObjInPanel = elementInPanel.businessObject;
  }

  private _publishDiagramChange(): void {
    this._eventAggregator.publish(environment.events.diagramChange);
  }
}
