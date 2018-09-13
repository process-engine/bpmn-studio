import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';
import {
  IBpmnModdle,
  IBpmnModeler,
  IModdleElement,
  IPageModel,
  ISection,
  IShape,
} from '../../../../../../contracts';
import environment from '../../../../../../environment';

enum TimerType {
  Date,
  Duration,
  Cycle,
}

@inject(EventAggregator)
export class TimerEventSection implements ISection {

  public path: string = '/sections/timer-event/timer-event';
  public canHandleElement: boolean = false;
  public timerElement: IModdleElement;
  public TimerType: typeof TimerType = TimerType;
  public timerType: TimerType;

  private _businessObjInPanel: IModdleElement;
  private _moddle: IBpmnModdle;
  private _eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this._eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    this._businessObjInPanel = model.elementInPanel.businessObject;

    this._moddle = model.modeler.get('moddle');
    this.timerElement = this._getTimerElement();

    this._init();
  }

  public isSuitableForElement(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.eventDefinitions !== undefined
        && element.businessObject.eventDefinitions[0] !== undefined
        && element.businessObject.eventDefinitions[0].$type === 'bpmn:TimerEventDefinition';
  }

  public updateTimerType(): void {
    const moddleElement: IModdleElement = this._moddle.create('bpmn:FormalExpression', {body: this.timerElement.body});
    const timerTypeObject: Object = {
      timeDate: (this.timerType === TimerType.Date) ? moddleElement : undefined,
      timeDuration: (this.timerType === TimerType.Duration) ? moddleElement : undefined,
      timeCycle: (this.timerType === TimerType.Cycle) ? moddleElement : undefined,
    };

    Object.assign(this._businessObjInPanel.eventDefinitions[0], timerTypeObject);
    this.timerElement.body = '';
    this._publishDiagramChange();
  }

  public updateTimerDefinition(): void {
    const timeElement: IModdleElement = this._getTimerElement();
    timeElement.body = this.timerElement.body;
    this._publishDiagramChange();
  }

  private _init(): void {
    const {timeDate, timeDuration, timeCycle} = this._businessObjInPanel.eventDefinitions[0];

    if ((timeDate === undefined)
        && (timeDuration === undefined)
        && (timeCycle === undefined)) {
      return;
    }

    if (timeCycle !== undefined) {
      this.timerType = TimerType.Cycle;
      return;
    }

    if (timeDuration !== undefined) {
      this.timerType = TimerType.Duration;
      return;
    }

    if (timeDate !== undefined) {
      this.timerType = TimerType.Date;
      return;
    }
  }

  private _getTimerElement(): IModdleElement {
    const {timeDuration, timeDate, timeCycle} = this._businessObjInPanel.eventDefinitions[0];

    if (timeDuration !== undefined) {
       return timeDuration;
    }
    if (timeDate !== undefined) {
      return timeDate;
    }
    if (timeCycle !== undefined) {
      return timeCycle;
    }

    const timerEventDefinition: IModdleElement = this._moddle.create('bpmn:FormalExpression', {body: ''});
    return timerEventDefinition;
  }

  private _publishDiagramChange(): void {
    this._eventAggregator.publish(environment.events.diagramChange);
  }

}
