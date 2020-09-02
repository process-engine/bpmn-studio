/* eslint-disable no-underscore-dangle */
import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {
  IEventElement,
  IModdleElement,
  IShape,
  ISignal,
  ISignalEventDefinition,
  ISignalEventElement,
} from '@process-engine/bpmn-elements_contracts';

import {
  IBpmnModdle,
  IBpmnModeler,
  IElementRegistry,
  ILinting,
  IPageModel,
  ISection,
} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';
import {generateRandomId} from '../../../../../../../services/generate-random-id-module/generate-random-id-module';

@inject(EventAggregator)
export class SignalEventSection implements ISection {
  public path: string = '/sections/signal-event/signal-event';
  public canHandleElement: boolean = false;
  public signals: Array<ISignal>;
  public selectedId: string;
  public selectedSignal: ISignal;

  private businessObjInPanel: ISignalEventElement;
  private moddle: IBpmnModdle;
  private modeler: IBpmnModeler;
  private linter: ILinting;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    if (model == null) {
      return;
    }

    this.businessObjInPanel = model.elementInPanel.businessObject as ISignalEventElement;
    this.moddle = model.modeler.get('moddle');
    this.modeler = model.modeler;
    this.linter = this.modeler.get('linting');

    this.signals = await this.getSignals();

    this.init();
  }

  public isSuitableForElement(element: IShape): boolean {
    return this.elementIsSignalEvent(element);
  }

  public updateSignal(): void {
    this.selectedSignal = this.signals.find((signal: ISignal) => {
      return signal.id === this.selectedId;
    });

    const signalElement: ISignalEventDefinition = this.businessObjInPanel.eventDefinitions[0];
    const eventDefinitionSet: boolean = signalElement.signalRef !== undefined;
    const signalGotSelected: boolean = this.selectedSignal !== undefined;

    if (eventDefinitionSet && signalGotSelected) {
      const signalIsAlreadySet: boolean = signalElement.signalRef.id === this.selectedSignal.id;

      if (signalIsAlreadySet) {
        return;
      }
    }

    signalElement.signalRef = this.selectedSignal;
    this.publishDiagramChange();

    if (this.linter.lintingActive()) {
      this.linter.update();
    }
  }

  public updateName(): void {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;
    const signal: ISignal = rootElements.find((element: IModdleElement) => {
      const elementIsSelectedSignal: boolean = element.$type === 'bpmn:Signal' && element.id === this.selectedId;
      return elementIsSelectedSignal;
    });

    signal.name = this.selectedSignal.name;
    this.publishDiagramChange();
  }

  public async addSignal(): Promise<void> {
    const bpmnSignalProperty: {id: string; name: string} = {
      id: `Signal_${generateRandomId()}`,
      name: 'Signal Name',
    };
    const bpmnSignal: ISignal = this.moddle.create('bpmn:Signal', bpmnSignalProperty);

    this.modeler._definitions.rootElements.push(bpmnSignal);

    const {xml: xmlStrUpdated} = await this.moddle.toXML(this.modeler._definitions);

    await this.modeler.importXML(xmlStrUpdated);
    await this.refreshSignals();
    this.setBusinessObj();
    this.selectedId = bpmnSignal.id;
    this.selectedSignal = bpmnSignal;
    this.updateSignal();

    this.publishDiagramChange();
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
    this.modeler._definitions.rootElements.splice(this.getRootElementsIndex(this.selectedId), 1);

    this.updateSignal();
  }

  private getRootElementsIndex(elementId: string): number {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;

    const rootElementsIndex: number = rootElements.findIndex((element: IModdleElement) => {
      return element.id === elementId;
    });

    return rootElementsIndex;
  }

  private elementIsSignalEvent(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element === undefined || element.businessObject === undefined;

    if (elementHasNoBusinessObject) {
      return false;
    }

    const eventElement: IEventElement = element.businessObject as IEventElement;

    const elementIsSignalEvent: boolean =
      eventElement.eventDefinitions !== undefined &&
      eventElement.eventDefinitions[0] !== undefined &&
      eventElement.eventDefinitions[0].$type === 'bpmn:SignalEventDefinition';

    return elementIsSignalEvent;
  }

  private init(): void {
    const eventDefinitions: Array<ISignalEventDefinition> = this.businessObjInPanel.eventDefinitions;
    const businessObjectHasNoSignalEvents: boolean =
      eventDefinitions === undefined ||
      eventDefinitions === null ||
      eventDefinitions[0].$type !== 'bpmn:SignalEventDefinition';
    if (businessObjectHasNoSignalEvents) {
      return;
    }

    const signalElement: ISignalEventDefinition = this.businessObjInPanel.eventDefinitions[0];
    const elementHasNoSignalRef: boolean = signalElement.signalRef === undefined;

    if (elementHasNoSignalRef) {
      this.selectedSignal = null;
      this.selectedId = null;

      return;
    }

    const signalId: string = signalElement.signalRef.id;
    const elementReferencesSignal: boolean = this.getSignalById(signalId) !== undefined;

    if (elementReferencesSignal) {
      this.selectedId = signalId;

      this.selectedSignal = this.signals.find((signal: ISignal) => {
        return signal.id === this.selectedId;
      });
    } else {
      this.selectedSignal = null;
      this.selectedId = null;
    }
  }

  private getSignalById(signalId: string): ISignal {
    const signals: Array<ISignal> = this.getSignals();
    const signal: ISignal = signals.find((signalElement: ISignal) => {
      return signalElement.id === signalId;
    });

    return signal;
  }

  private getSignals(): Array<ISignal> {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;
    const signals: Array<ISignal> = rootElements.filter((element: IModdleElement) => {
      return element.$type === 'bpmn:Signal';
    });

    return signals;
  }

  private async refreshSignals(): Promise<void> {
    this.signals = await this.getSignals();
  }

  private setBusinessObj(): void {
    const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');
    const elementInPanel: IShape = elementRegistry.get(this.businessObjInPanel.id);
    this.businessObjInPanel = elementInPanel.businessObject as ISignalEventElement;
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
