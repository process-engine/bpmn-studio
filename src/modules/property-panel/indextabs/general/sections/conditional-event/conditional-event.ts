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

  public conditionalElement: IModdleElement;
  public variableName: string;
  public variableEvent: string;

  public activate(model: IPageModel): void {
    this.businessObjInPanel = model.elementInPanel.businessObject;

    this.moddle = model.modeler.get('moddle');

    this._init();
  }

  private _init(): void {
    this.conditionalElement = this._getConditionalElement();

    const {variableName, variableEvent} = this.businessObjInPanel.eventDefinitions[0];

    this.variableEvent = (variableEvent === undefined) ? '' : variableEvent;
    this.variableName = (variableName === undefined) ? '' : variableName;
  }

  private _getConditionalElement(): IModdleElement {
    const {condition} = this.businessObjInPanel.eventDefinitions[0];
    const conditionalEventDefinition: IModdleElement = this.moddle.create('bpmn:FormalExpression', {body: ''});
    return (condition === undefined) ? conditionalEventDefinition : condition;
  }

  public isSuitableForElement(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.eventDefinitions !== undefined
        && element.businessObject.eventDefinitions[0].$type === 'bpmn:ConditionalEventDefinition';
  }

  public updateConditionalElement(): void {
    const conditionalElement: IModdleElement = this._getConditionalElement();
    conditionalElement.body = this.conditionalElement.body;
  }

  public updateVariableName(): void {
    this.businessObjInPanel.eventDefinitions[0].variableName = this.variableName;
  }

  public updateVariableEvent(): void {
    this.businessObjInPanel.eventDefinitions[0].variableEvent = this.variableEvent;
  }

  public clearCondition(): void {
    this.conditionalElement.body = '';
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
