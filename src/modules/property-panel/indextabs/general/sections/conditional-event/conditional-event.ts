import {
  IBpmnModdle,
  IModdleElement,
  IPageModel,
  ISection,
  IShape,
} from '../../../../../../contracts';

export class ConditionalEventSection implements ISection {

  public path: string = '/sections/conditional-event/conditional-event';
  public canHandleElement: boolean = false;

  private businessObjInPanel: IModdleElement;
  private moddle: IBpmnModdle;

  public conditionBody: string;
  public variableName: string;
  public variableEvent: string;

  public activate(model: IPageModel): void {
    this.businessObjInPanel = model.elementInPanel.businessObject;

    this.moddle = model.modeler.get('moddle');

    this._init();
  }

  private _init(): void {
    const {variableName, variableEvent, condition} = this.businessObjInPanel.eventDefinitions[0];

    this.variableEvent = (variableEvent === undefined) ? '' : variableEvent;
    this.variableName = (variableName === undefined) ? '' : variableName;
    this.conditionBody = (condition === undefined) ? '' : condition.body;
  }

  private _createCondition(): IModdleElement {
    return this.moddle.create('bpmn:FormalExpression', {body: ''});
  }

  public isSuitableForElement(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.eventDefinitions !== undefined
        && element.businessObject.eventDefinitions[0].$type === 'bpmn:ConditionalEventDefinition';
  }

  public updateConditionalElement(): void {
    const condition: IModdleElement = this._createCondition();
    condition.body = this.conditionBody;
    this.businessObjInPanel.eventDefinitions[0].condition = condition;
  }

  public updateVariableName(): void {
    this.businessObjInPanel.eventDefinitions[0].variableName = this.variableName;
  }

  public updateVariableEvent(): void {
    this.businessObjInPanel.eventDefinitions[0].variableEvent = this.variableEvent;
  }

  public clearCondition(): void {
    this.conditionBody = '';
    this.updateConditionalElement();
  }

  public clearVariableName(): void {
    this.variableName = '';
    this.updateVariableName();
  }

  public clearVariableEvent(): void {
    this.variableEvent = '';
    this.updateVariableEvent();
  }
}
