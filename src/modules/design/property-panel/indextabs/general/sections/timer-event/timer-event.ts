import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';

import {
  IEventElement,
  IExtensionElement,
  IModdleElement,
  IPropertiesElement,
  IProperty,
  IShape,
  ITimerEventElement,
} from '@process-engine/bpmn-elements_contracts';
import {HelpModalService} from '../../../../../../../services/help-modal-service/help-modal-service';

import {HelpTextId, IBpmnModdle, ILinting, IPageModel, ISection} from '../../../../../../../contracts/index';
import environment from '../../../../../../../environment';

enum TimerType {
  Date,
  Duration,
  Cycle,
}

enum TimerEventType {
  StartEvent = 'bpmn:StartEvent',
  IntermediateEvent = 'bpmn:IntermediateCatchEvent',
  BoundaryEvent = 'bpmn:BoundaryEvent',
}
@inject(EventAggregator, HelpModalService)
export class TimerEventSection implements ISection {
  public path: string = '/sections/timer-event/timer-event';
  public canHandleElement: boolean = false;
  public timerElement: IModdleElement;
  // eslint-disable-next-line @typescript-eslint/member-naming
  public TimerType: typeof TimerType = TimerType;
  public timerType: TimerType;
  @bindable public isEnabled: boolean = true;
  // eslint-disable-next-line @typescript-eslint/member-naming
  public TimerEventType: typeof TimerEventType = TimerEventType;
  public timerEventType: TimerEventType;

  private businessObjInPanel: ITimerEventElement;
  private moddle: IBpmnModdle;
  private linter: ILinting;
  private eventAggregator: EventAggregator;
  private helpModalService: HelpModalService;

  constructor(eventAggregator?: EventAggregator, helpModalService?: HelpModalService) {
    this.eventAggregator = eventAggregator;
    this.helpModalService = helpModalService;
  }

  public activate(model: IPageModel): void {
    this.businessObjInPanel = model.elementInPanel.businessObject as ITimerEventElement;

    this.moddle = model.modeler.get('moddle');
    this.linter = model.modeler.get('linting');

    this.timerEventType = this.getTimerEventType();
    this.timerElement = this.getTimerElement();

    this.init();
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element === undefined || element.businessObject === undefined;

    if (elementHasNoBusinessObject) {
      return false;
    }

    const eventElement: IEventElement = element.businessObject as IEventElement;

    const elementIsTimerEvent: boolean =
      eventElement.eventDefinitions !== undefined &&
      eventElement.eventDefinitions[0] !== undefined &&
      eventElement.eventDefinitions[0].$type === 'bpmn:TimerEventDefinition';

    return elementIsTimerEvent;
  }

  public showTimerHelpModal(): void {
    switch (this.timerEventType) {
      case TimerEventType.StartEvent:
        this.helpModalService.showHelpModal(HelpTextId.TimerStartEventUsage);
        break;
      case TimerEventType.IntermediateEvent:
        this.helpModalService.showHelpModal(HelpTextId.IntermediateTimerEventUsage);
        break;
      case TimerEventType.BoundaryEvent:
        this.helpModalService.showHelpModal(HelpTextId.TimerBoundaryEventUsage);
        break;
      default:
        break;
    }
  }

  public updateTimerType(): void {
    const moddleElement: IModdleElement = this.moddle.create('bpmn:FormalExpression', {
      body: this.timerElement.body,
    });

    let timerTypeObject: object;

    switch (this.timerType) {
      case TimerType.Date: {
        timerTypeObject = {
          timeDate: moddleElement,
        };
        break;
      }
      case TimerType.Duration: {
        timerTypeObject = {
          timeDuration: moddleElement,
        };
        break;
      }
      case TimerType.Cycle: {
        timerTypeObject = this.timerEventType === TimerEventType.StartEvent ? {timeCycle: moddleElement} : {};
        break;
      }
      default: {
        timerTypeObject = {};
      }
    }

    delete this.businessObjInPanel.eventDefinitions[0].timeCycle;
    delete this.businessObjInPanel.eventDefinitions[0].timeDuration;
    delete this.businessObjInPanel.eventDefinitions[0].timeDate;

    Object.assign(this.businessObjInPanel.eventDefinitions[0], timerTypeObject);
    this.timerElement.body = '';

    this.publishDiagramChange();
    this.updateLinterWhenActive();
  }

  public updateTimerDefinition(): void {
    const timerElement: IModdleElement = this.getTimerElement();
    timerElement.body = this.timerElement.body;

    this.publishDiagramChange();
    this.updateLinterWhenActive();
  }

  public isEnabledChanged(): void {
    const enabledProperty: IProperty = this.getProperty('enabled');
    enabledProperty.value = this.isEnabled.toString();

    this.publishDiagramChange();
  }

  private getTimerEventType(): TimerEventType {
    switch (this.businessObjInPanel.$type) {
      case TimerEventType.StartEvent:
        return TimerEventType.StartEvent;
      case TimerEventType.IntermediateEvent:
        return TimerEventType.IntermediateEvent;
      case TimerEventType.BoundaryEvent:
        return TimerEventType.BoundaryEvent;
      default:
        throw new Error('Timer Event is not a StartEvent nor a IntermediateEvent or BoundaryEvent');
    }
  }

  private init(): void {
    if (this.timerEventType === TimerEventType.StartEvent) {
      const extensionElementDoesNotExist: boolean = this.businessObjInPanel.extensionElements === undefined;
      if (extensionElementDoesNotExist) {
        this.createExtensionElement();
      }

      const propertyElementDoesNotExists: boolean = this.getPropertiesElement() === undefined;
      if (propertyElementDoesNotExists) {
        this.createPropertiesElement();
      }

      const enabledProperty: IProperty = this.getProperty('enabled');

      const enabledPropertyExists: boolean = enabledProperty !== undefined;
      if (enabledPropertyExists) {
        this.isEnabled = enabledProperty.value === 'true';
      } else {
        this.createProperty('enabled');
        this.getProperty('enabled').value = 'true';
      }
    }

    const {timeDate, timeDuration, timeCycle} = this.businessObjInPanel.eventDefinitions[0];

    if (timeCycle !== undefined && this.timerEventType === TimerEventType.StartEvent) {
      this.timerType = TimerType.Cycle;
      return;
    }

    if (timeDuration !== undefined) {
      this.timerType = TimerType.Duration;
      return;
    }

    if (timeDate !== undefined) {
      this.timerType = TimerType.Date;
    }
  }

  private getTimerElement(): IModdleElement {
    const {timeDuration, timeDate, timeCycle} = this.businessObjInPanel.eventDefinitions[0];

    if (timeDuration !== undefined) {
      return timeDuration;
    }
    if (timeDate !== undefined) {
      return timeDate;
    }

    if (timeCycle !== undefined && this.timerEventType === TimerEventType.StartEvent) {
      return timeCycle;
    }

    const timerEventDefinition: IModdleElement = this.moddle.create('bpmn:FormalExpression', {body: ''});
    return timerEventDefinition;
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }

  private updateLinterWhenActive(): void {
    if (this.linter.lintingActive()) {
      this.linter.update();
    }
  }

  private createExtensionElement(): void {
    const extensionValues: Array<IModdleElement> = [];

    const extensionElements: IModdleElement = this.moddle.create('bpmn:ExtensionElements', {
      values: extensionValues,
    });
    this.businessObjInPanel.extensionElements = extensionElements;
  }

  private createPropertiesElement(): void {
    const extensionElement: IExtensionElement = this.businessObjInPanel.extensionElements;

    const properties: Array<IProperty> = [];
    const propertiesElement: IPropertiesElement = this.moddle.create('camunda:Properties', {values: properties});

    extensionElement.values.push(propertiesElement);
  }

  private createProperty(propertyName: string): void {
    const propertiesElement: IPropertiesElement = this.getPropertiesElement();

    const propertyObject: object = {
      name: propertyName,
      value: '',
    };

    const property: IProperty = this.moddle.create('camunda:Property', propertyObject);

    propertiesElement.values.push(property);
  }

  private getProperty(propertyName: string): IProperty {
    const propertiesElement: IPropertiesElement = this.getPropertiesElement();

    const property: IProperty = propertiesElement.values.find((element: IProperty) => {
      return element.name === propertyName;
    });

    return property;
  }

  private getPropertiesElement(): IPropertiesElement {
    const propertiesElement: IPropertiesElement = this.businessObjInPanel.extensionElements.values.find(
      (element: IPropertiesElement) => {
        return element.$type === 'camunda:Properties' && element.values !== undefined;
      },
    );

    return propertiesElement;
  }
}
