import {
  IBpmnModdle,
  IBpmnModeler,
  IModdleElement,
  IPageModel,
  ISection,
  IShape,
} from '../../../../../../contracts';

enum TimerType {
  Date,
  Duration,
  Cycle,
}

export class TimerEventSection implements ISection {

  public path: string = '/sections/timer-event/timer-event';
  public canHandleElement: boolean = false;

  private businessObjInPanel: IModdleElement;
  private moddle: IBpmnModdle;
  private modeler: IBpmnModeler;

  public timerElement: IModdleElement;
  public TimerType: typeof TimerType = TimerType;
  public timerType: TimerType;

  public activate(model: IPageModel): void {
    this.businessObjInPanel = model.elementInPanel.businessObject;

    this.moddle = model.modeler.get('moddle');
    this.modeler = model.modeler;
    this.timerElement = this._getTimerElement();

    this._init();
  }

  private _init(): void {
    const {timeDate, timeDuration, timeCycle} = this.businessObjInPanel.eventDefinitions[0];

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
    const {timeDuration, timeDate, timeCycle} = this.businessObjInPanel.eventDefinitions[0];

    if (timeDuration !== undefined) {
       return timeDuration;
    }
    if (timeDate !== undefined) {
      return timeDate;
    }
    if (timeCycle !== undefined) {
      return timeCycle;
    }

    const timerEventDefinition: IModdleElement = this.moddle.create('bpmn:FormalExpression', {body: ''});
    return timerEventDefinition;
  }

  public isSuitableForElement(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.eventDefinitions !== undefined
        && element.businessObject.eventDefinitions[0].$type === 'bpmn:TimerEventDefinition';
  }

  public updateTimerType(): void {
    const moddleElement: IModdleElement = this.moddle.create('bpmn:FormalExpression', {body: this.timerElement.body});
    const timerTypeObject: Object = {
      timeDate: (this.timerType === TimerType.Date) ? moddleElement : undefined,
      timeDuration: (this.timerType === TimerType.Duration) ? moddleElement : undefined,
      timeCycle: (this.timerType === TimerType.Cycle) ? moddleElement : undefined,
    };

    Object.assign(this.businessObjInPanel.eventDefinitions[0], timerTypeObject);
    this.timerElement.body = '';
  }

  public updateTimerDefinition(): void {
    const timeElement: IModdleElement = this._getTimerElement();
    timeElement.body = this.timerElement.body;
  }

  public clearDefinition(): void {
    this.timerElement.body = '';
  }
}
