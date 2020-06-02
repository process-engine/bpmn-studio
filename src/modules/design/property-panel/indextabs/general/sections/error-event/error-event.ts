/* eslint-disable no-underscore-dangle */
import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {
  IError,
  IErrorEventDefinition,
  IErrorEventElement,
  IEventElement,
  IModdleElement,
  IShape,
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
export class ErrorEventSection implements ISection {
  public path: string = '/sections/error-event/error-event';
  public canHandleElement: boolean = false;
  public errors: Array<IError>;
  public selectedId: string;
  public selectedError: IError;
  public isEndEvent: boolean = false;
  public errorMessageVariable: string;

  private businessObjInPanel: IErrorEventElement;
  private moddle: IBpmnModdle;
  private modeler: IBpmnModeler;
  private linter: ILinting;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    this.businessObjInPanel = model.elementInPanel.businessObject as IErrorEventElement;

    this.moddle = model.modeler.get('moddle');
    this.modeler = model.modeler;
    this.linter = model.modeler.get('linting');

    this.isEndEvent = this.elementIsEndEvent(model.elementInPanel);
    this.errors = await this.getErrors();

    this.init();
  }

  public isSuitableForElement(element: IShape): boolean {
    if (this.elementIsErrorEvent(element)) {
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

    const errorElement: IErrorEventDefinition = this.businessObjInPanel.eventDefinitions[0];

    errorElement.errorRef = this.selectedError;
    this.persistErrorMessageInError(errorElement);
    this.publishDiagramChange();

    if (this.linter.lintingActive()) {
      this.linter.update();
    }
  }

  public updateErrorName(): void {
    const selectedError: IError = this.getSelectedError();
    selectedError.name = this.selectedError.name;
    this.publishDiagramChange();
  }

  public updateErrorCode(): void {
    const selectedError: IError = this.getSelectedError();
    selectedError.errorCode = this.selectedError.errorCode;
    this.publishDiagramChange();
  }

  public updateErrorMessage(): void {
    const selectedError: IError = this.getSelectedError();
    selectedError.errorMessage = this.errorMessageVariable;
    this.publishDiagramChange();
  }

  public async addError(): Promise<void> {
    const bpmnErrorObject: {id: string; name: string} = {
      id: `Error_${generateRandomId()}`,
      name: 'Error Name',
    };
    const bpmnError: IError = this.moddle.create('bpmn:Error', bpmnErrorObject);

    this.modeler._definitions.rootElements.push(bpmnError);

    this.moddle.toXML(this.modeler._definitions, (toXMLError: Error, xmlStrUpdated: string) => {
      this.modeler.importXML(xmlStrUpdated, async (importXMLError: Error) => {
        await this.refreshErrors();
        await this.setBusinessObject();
        this.selectedId = bpmnError.id;
        this.selectedError = bpmnError;
        this.updateError();
      });
    });
    this.publishDiagramChange();
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
    this.modeler._definitions.rootElements.splice(this.getRootElementsIndex(this.selectedId), 1);

    this.updateError();
    this.publishDiagramChange();
  }

  private getRootElementsIndex(elementId: string): number {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;

    const rootElementsIndex: number = rootElements.findIndex((element: IModdleElement) => {
      return element.id === elementId;
    });

    return rootElementsIndex;
  }

  private init(): void {
    const eventDefinitions: Array<IErrorEventDefinition> = this.businessObjInPanel.eventDefinitions;
    const businessObjecthasNoErrorEvents: boolean =
      eventDefinitions === undefined ||
      eventDefinitions === null ||
      eventDefinitions[0].$type !== 'bpmn:ErrorEventDefinition';

    if (businessObjecthasNoErrorEvents) {
      return;
    }

    const errorElement: IErrorEventDefinition = this.businessObjInPanel.eventDefinitions[0];
    const elementHasNoErrorRef: boolean = errorElement.errorRef === undefined;

    if (elementHasNoErrorRef) {
      this.selectedError = null;
      this.selectedId = null;

      return;
    }

    const errorId: string = errorElement.errorRef.id;
    const elementReferencesError: boolean = this.getErrorById(errorId) !== undefined;

    if (elementReferencesError) {
      this.selectedId = errorId;

      this.selectedError = this.errors.find((error: IError) => {
        return error.id === this.selectedId;
      });

      this.persistErrorMessageInError(errorElement);
    } else {
      this.selectedError = null;
      this.selectedId = null;
    }
  }

  private getErrorById(errorId: string): IError {
    const errors: Array<IError> = this.getErrors();
    const error: IError = errors.find((errorElement: IError) => {
      return errorId === errorElement.id;
    });

    return error;
  }

  private elementIsErrorEvent(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element === undefined || element.businessObject === undefined;

    if (elementHasNoBusinessObject) {
      return false;
    }

    const eventElement: IEventElement = element.businessObject as IEventElement;

    const elementIsErrorEvent: boolean =
      eventElement.eventDefinitions !== undefined &&
      eventElement.eventDefinitions[0] !== undefined &&
      eventElement.eventDefinitions[0].$type === 'bpmn:ErrorEventDefinition';

    return elementIsErrorEvent;
  }

  private elementIsEndEvent(element: IShape): boolean {
    return (
      element !== undefined && element.businessObject !== undefined && element.businessObject.$type === 'bpmn:EndEvent'
    );
  }

  private getErrors(): Array<IError> {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;
    const errors: Array<IError> = rootElements.filter((element: IModdleElement) => {
      return element.$type === 'bpmn:Error';
    });

    return errors;
  }

  private getSelectedError(): IError {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;
    const selectedError: IError = rootElements.find((element: IModdleElement) => {
      const isSelectedError: boolean = element.$type === 'bpmn:Error' && element.id === this.selectedId;

      return isSelectedError;
    });

    return selectedError;
  }

  private setBusinessObject(): void {
    const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');
    const elementInPanel: IShape = elementRegistry.get(this.businessObjInPanel.id);
    this.businessObjInPanel = elementInPanel.businessObject as IErrorEventElement;
  }

  private async refreshErrors(): Promise<void> {
    this.errors = await this.getErrors();
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }

  private persistErrorMessageInError(errorElement: IErrorEventDefinition): void {
    const errorMessageExistOnError = this.selectedError.errorMessage != null;
    if (errorMessageExistOnError) {
      this.errorMessageVariable = this.selectedError.errorMessage;
    } else if (errorElement.errorMessageVariable) {
      this.errorMessageVariable = errorElement.errorMessageVariable;
      this.selectedError.errorMessage = this.errorMessageVariable;
      delete errorElement.errorMessageVariable;
    }
  }
}
