import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {IConditionalEventElement, IEventElement, IModdleElement, IShape} from '@process-engine/bpmn-elements_contracts';

import {IBpmnModdle, ILinting, IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';

@inject(EventAggregator)
export class ConditionalEventSection implements ISection {
  public path: string = '/sections/conditional-event/conditional-event';
  public canHandleElement: boolean = false;
  public conditionBody: string;
  public variableName: string;
  public variableEvent: string;

  private businessObjInPanel: IConditionalEventElement;
  private moddle: IBpmnModdle;
  private linter: ILinting;
  private conditionObject: IModdleElement;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    if (model == null) {
      return;
    }

    this.moddle = model.modeler.get('moddle');
    this.linter = model.modeler.get('linting');
    this.businessObjInPanel = model.elementInPanel.businessObject as IConditionalEventElement;

    const {variableName, variableEvent, condition} = this.businessObjInPanel.eventDefinitions[0];

    this.variableEvent = variableEvent === undefined ? '' : variableEvent;
    this.variableName = variableName === undefined ? '' : variableName;
    this.conditionBody = condition === undefined ? '' : condition.body;

    this.conditionObject = this.moddle.create('bpmn:FormalExpression', {body: this.conditionBody});
    this.businessObjInPanel.eventDefinitions[0].condition = this.conditionObject;
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element === undefined || element.businessObject === undefined;
    if (elementHasNoBusinessObject) {
      return false;
    }

    const eventElement: IEventElement = element.businessObject as IEventElement;

    const elementIsConditionalEvent: boolean =
      eventElement.eventDefinitions !== undefined &&
      eventElement.eventDefinitions[0] !== undefined &&
      eventElement.eventDefinitions[0].$type === 'bpmn:ConditionalEventDefinition';

    return elementIsConditionalEvent;
  }

  public updateCondition(): void {
    this.businessObjInPanel.eventDefinitions[0].condition.body = this.conditionBody;
    this.publishDiagramChange();

    if (this.linter.lintingActive()) {
      this.linter.update();
    }
  }

  public updateVariableName(): void {
    this.businessObjInPanel.eventDefinitions[0].variableName = this.variableName;
    this.publishDiagramChange();
  }

  public updateVariableEvent(): void {
    this.businessObjInPanel.eventDefinitions[0].variableEvent = this.variableEvent;
    this.publishDiagramChange();
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
