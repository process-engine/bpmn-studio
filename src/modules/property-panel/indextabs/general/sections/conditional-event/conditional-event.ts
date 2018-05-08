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

  public conditionBody: string;
  public variableName: string;
  public variableEvent: string;

  private _businessObjInPanel: IModdleElement;
  private _moddle: IBpmnModdle;
  private _conditionObject: IModdleElement;

  public activate(model: IPageModel): void {
    this._moddle = model.modeler.get('moddle');
    this._businessObjInPanel = model.elementInPanel.businessObject;

    const {variableName, variableEvent, condition} = this._businessObjInPanel.eventDefinitions[0];

    this.variableEvent = (variableEvent === undefined) ? '' : variableEvent;
    this.variableName = (variableName === undefined) ? '' : variableName;
    this.conditionBody = (condition === undefined) ? '' : condition.body;

    this._conditionObject = this._moddle.create('bpmn:FormalExpression', {body: this.conditionBody});
    this._businessObjInPanel.eventDefinitions[0].condition = this._conditionObject;
  }

  public isSuitableForElement(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.eventDefinitions !== undefined
        && element.businessObject.eventDefinitions[0].$type === 'bpmn:ConditionalEventDefinition';
  }

  public updateCondition(): void {
    this._businessObjInPanel.eventDefinitions[0].condition.body = this.conditionBody;
  }

  public updateVariableName(): void {
    this._businessObjInPanel.eventDefinitions[0].variableName = this.variableName;
  }

  public updateVariableEvent(): void {
    this._businessObjInPanel.eventDefinitions[0].variableEvent = this.variableEvent;
  }

  public clearCondition(): void {
    this.conditionBody = '';
    this.updateCondition();
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
