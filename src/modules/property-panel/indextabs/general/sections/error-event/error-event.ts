import {
  IBpmnModdle,
  IBpmnModeler,
  IElementRegistry,
  IError,
  IErrorElement,
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
export class ErrorEventSection implements ISection {

  public path: string = '/sections/error-event/error-event';
  public canHandleElement: boolean = false;
  public errors: Array<IError>;
  public selectedId: string;
  public selectedError: IError;
  public isEndEvent: boolean = false;
  public errorMessageVariable: string;

  private _businessObjInPanel: IErrorElement;
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
    this.errors = await this._getErrors();

    this._init();
  }

  public isSuitableForElement(element: IShape): boolean {
    if (this._elementIsErrorEvent(element)) {
      this.isEndEvent = this._elementIsEndEvent(element);
      return true;
    }
    return false;
  }

  public updateError(): void {
    if (this.selectedId === undefined || this.selectedId === null) {
      this.selectedError = null;
      return;
    }

    this.selectedError = this.errors.find((error: IError) => {
      return error.id === this.selectedId;
    });

    const errorElement: IErrorElement = this._businessObjInPanel.eventDefinitions[0];

    errorElement.errorRef = this.selectedError;
    if (!this.isEndEvent) {
      this.errorMessageVariable = errorElement.errorMessageVariable;
    }
    this._publishDiagramChange();
  }

  public updateErrorName(): void {
    const selectedError: IError = this._getSlectedError();
    selectedError.name = this.selectedError.name;
    this._publishDiagramChange();
  }

  public updateErrorCode(): void {
    const selectedError: IError = this._getSlectedError();
    selectedError.errorCode = this.selectedError.errorCode;
    this._publishDiagramChange();
  }

  public updateErrorMessage(): void {
    const errorElement: IErrorElement = this._businessObjInPanel.eventDefinitions[0];
    errorElement.errorMessageVariable = this.errorMessageVariable;
    this._publishDiagramChange();
  }

  public async addError(): Promise<void> {

    const bpmnErrorObject: {id: string, name: string} = {
      id: `Error_${this._generalService.generateRandomId()}`,
      name: 'Error Name',
    };
    const bpmnError: IError = this._moddle.create('bpmn:Error', bpmnErrorObject);

    this._modeler._definitions.rootElements.push(bpmnError);

    this._moddle.toXML(this._modeler._definitions, (toXMLError: Error, xmlStrUpdated: string) => {
      this._modeler.importXML(xmlStrUpdated, async(importXMLError: Error) => {
        await this._refreshErrors();
        await this._setBusinessObject();
        this.selectedId = bpmnError.id;
        this.selectedError = bpmnError;
        this.updateError();
      });
    });
    this._publishDiagramChange();
  }

  public removeSelectedError(): void {
    const noErrorIsSelected: boolean = !this.selectedId;
    if (noErrorIsSelected) {
      return;
    }

    const errorIndex: number = this.errors.findIndex((error: IError) => {
      return error.id === this.selectedId;
    });

    this.errors.splice(errorIndex, 1);
    this._modeler._definitions.rootElements.splice(this._getRootElementsIndex(this.selectedId), 1);

    this.updateError();
    this._publishDiagramChange();
  }

  private _getRootElementsIndex(elementId: string): number {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;

    const rootElementsIndex: number = rootElements.findIndex((element: IModdleElement) => {
      return element.id === elementId;
    });

    return rootElementsIndex;
  }

  private _init(): void {
    const eventDefinitions: Array<IModdleElement> = this._businessObjInPanel.eventDefinitions;
    const businessObjecthasNoErrorEvents: boolean = eventDefinitions === undefined
                                                 || eventDefinitions === null
                                                 || eventDefinitions[0].$type !== 'bpmn:ErrorEventDefinition';

    if (businessObjecthasNoErrorEvents) {
      return;
    }

    const errorElement: IErrorElement = this._businessObjInPanel.eventDefinitions[0];
    const elementHasNoErrorRef: boolean = errorElement.errorRef === undefined;

    if (elementHasNoErrorRef) {
      this.selectedError = null;
      this.selectedId = null;

      return;
    }

    const errorId: string = errorElement.errorRef.id;
    const elementReferencesError: boolean = this._getErrorById(errorId) !== undefined;

    if (elementReferencesError) {
      this.selectedId = errorId;
      this.updateError();
    } else {
      this.selectedError = null;
      this.selectedId = null;
    }
  }

  private _getErrorById(errorId: string): IError {
    const errors: Array<IError> = this._getErrors();
    const error: IError = errors.find((errorElement: IError) => {
      return errorId === errorElement.id;
    });

    return error;
  }

  private _elementIsErrorEvent(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.eventDefinitions !== undefined
        && element.businessObject.eventDefinitions[0] !== undefined
        && element.businessObject.eventDefinitions[0].$type === 'bpmn:ErrorEventDefinition';
  }

  private _elementIsEndEvent(element: IShape): boolean {
    return element !== undefined
        && element.businessObject !== undefined
        && element.businessObject.$type === 'bpmn:EndEvent';
  }

  private _getErrors(): Array<IErrorElement> {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;
    const errors: Array<IErrorElement> = rootElements.filter((element: IModdleElement) => {
      return element.$type === 'bpmn:Error';
    });

    return errors;
  }

  private _getSlectedError(): IError {
    const rootElements: Array<IModdleElement> = this._modeler._definitions.rootElements;
    const selectedError: IError = rootElements.find((element: IModdleElement) => {
      const isSelectedError: boolean = element.$type === 'bpmn:Error' && element.id === this.selectedId;

      return isSelectedError;
    });

    return selectedError;
  }

  private _setBusinessObject(): void {
    const elementRegistry: IElementRegistry = this._modeler.get('elementRegistry');
    const elementInPanel: IShape = elementRegistry.get(this._businessObjInPanel.id);
    this._businessObjInPanel = elementInPanel.businessObject;
  }

  private async _refreshErrors(): Promise<void> {
    this.errors = await this._getErrors();
  }

  private _publishDiagramChange(): void {
    this._eventAggregator.publish(environment.events.diagramChange);
  }
}
