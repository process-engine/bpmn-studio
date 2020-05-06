import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {
  IExtensionElement,
  IModdleElement,
  IPropertiesElement,
  IProperty,
  IShape,
} from '@process-engine/bpmn-elements_contracts';

import {IBpmnModdle, IPageModel} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';

@inject(EventAggregator)
export class ProcessSection {
  public path: string = '/sections/process/process';
  public canHandleElement: boolean = false;

  public newNames: Array<string> = [];
  public newValues: Array<string> = [];
  public properties: Array<IProperty> = [];
  public shouldFocus: boolean = false;

  private businessObjInPanel: IModdleElement;
  private moddle: IBpmnModdle;
  private propertiesElement: IPropertiesElement;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    if (!model) {
      return;
    }

    this.businessObjInPanel = model.elementInPanel.businessObject.participants[0];
    this.moddle = model.modeler.get('moddle');
    this.reloadProperties();
  }

  public isSuitableForElement(element: IShape): boolean {
    const businessObjectIsNotExisting: boolean = element === undefined || element.businessObject === undefined;
    if (businessObjectIsNotExisting) {
      return false;
    }

    const elementIsRoot: boolean = element.businessObject.$type === 'bpmn:Collaboration';

    return elementIsRoot;
  }

  public addProperty(): void {
    const bpmnPropertyProperties: object = {
      name: '',
      value: '',
    };
    const bpmnProperty: IProperty = this.moddle.create('camunda:Property', bpmnPropertyProperties);

    this.newNames.push('');
    this.newValues.push('');

    const businessObjectHasNoExtensionElements: boolean =
      this.businessObjInPanel.processRef.extensionElements === undefined ||
      this.businessObjInPanel.processRef.extensionElements === null;
    if (businessObjectHasNoExtensionElements) {
      this.createExtensionElement();
    }

    this.propertiesElement = this.getPropertiesElement();

    const propertiesElementIsUndefined: boolean = this.propertiesElement === undefined;

    if (propertiesElementIsUndefined) {
      this.createEmptyCamundaProperties();
      this.propertiesElement = this.getPropertiesElement();
    }

    const propertyValuesUndefined: boolean = this.propertiesElement.values === undefined;
    if (propertyValuesUndefined) {
      this.propertiesElement.values = [];
    }

    this.propertiesElement.values.push(bpmnProperty);
    this.properties.push(bpmnProperty);
    this.publishDiagramChange();
    this.shouldFocus = true;
  }

  public removeProperty(index: number): void {
    const propertyIsLast: boolean = this.propertiesElement.values.length === 1;

    if (propertyIsLast) {
      this.businessObjInPanel.processRef.extensionElements = undefined;
    } else {
      this.propertiesElement.values.splice(index, 1);
    }

    this.reloadProperties();
    this.publishDiagramChange();
  }

  public changeName(index: number): void {
    this.propertiesElement.values[index].name = this.newNames[index];
    this.publishDiagramChange();
  }

  public changeValue(index: number): void {
    this.propertiesElement.values[index].value = this.newValues[index];
    this.publishDiagramChange();
  }

  public inputFieldBlurred(index: number, event: FocusEvent): void {
    const targetElement: HTMLElement = event.relatedTarget as HTMLElement;
    const targetIsNoInputField: boolean = !(targetElement instanceof HTMLInputElement);

    if (targetIsNoInputField) {
      this.checkAndRemoveEmptyProperties(index);

      return;
    }

    const targetFieldIndex: string = targetElement.getAttribute('data-fieldIndex');
    const indexAsString: string = index.toString();
    const targetValueFieldNotRelated: boolean = targetFieldIndex !== indexAsString;
    if (targetValueFieldNotRelated) {
      this.checkAndRemoveEmptyProperties(index);
    }
  }

  private checkAndRemoveEmptyProperties(index: number): void {
    const propertyElement: IProperty = this.propertiesElement.values[index];
    const propertyIsEmpty: boolean = propertyElement.value === '' && propertyElement.name === '';
    if (propertyIsEmpty) {
      this.removeProperty(index);
    }
  }

  private reloadProperties(): void {
    this.properties = [];
    this.newNames = [];
    this.newValues = [];
    this.shouldFocus = false;

    const businessObjectHasNoExtensionElements: boolean =
      this.businessObjInPanel.processRef.extensionElements === undefined ||
      this.businessObjInPanel.processRef.extensionElements === null;

    if (businessObjectHasNoExtensionElements) {
      return;
    }

    this.propertiesElement = this.getPropertiesElement();

    const extensionsPropertiesElement: IPropertiesElement = this.businessObjInPanel.processRef.extensionElements.values.find(
      (extensionValue: IExtensionElement) => {
        const extensionIsPropertyElement: boolean =
          extensionValue.$type === 'camunda:Properties' &&
          extensionValue.values !== undefined &&
          extensionValue.values !== null &&
          extensionValue.values.length !== 0;

        return extensionIsPropertyElement;
      },
    );

    const extensionElementHasNoPropertyElement: boolean = extensionsPropertiesElement === undefined;

    if (extensionElementHasNoPropertyElement) {
      return;
    }

    const properties: Array<IProperty> = extensionsPropertiesElement.values;
    for (const property of properties) {
      const propertyTypeIsNotCamunda: boolean = property.$type !== 'camunda:Property';

      if (propertyTypeIsNotCamunda) {
        continue;
      }
      this.newNames.push(property.name);
      this.newValues.push(property.value);
      this.properties.push(property);
    }
  }

  private getPropertiesElement(): IPropertiesElement {
    const propertiesElement: IPropertiesElement = this.businessObjInPanel.processRef.extensionElements.values.find(
      (extensionValue: IExtensionElement) => {
        const extensionIsPropertiesElement: boolean = extensionValue.$type === 'camunda:Properties';

        return extensionIsPropertiesElement;
      },
    );

    return propertiesElement;
  }

  private createExtensionElement(): void {
    const bpmnExecutionListenerProperties: object = {
      class: '',
      event: '',
    };
    const bpmnExecutionListener: IModdleElement = this.moddle.create(
      'camunda:ExecutionListener',
      bpmnExecutionListenerProperties,
    );

    const extensionValues: Array<IModdleElement> = [];
    const propertiesElement: IPropertiesElement = this.moddle.create('camunda:Properties', {values: []});

    extensionValues.push(bpmnExecutionListener);
    extensionValues.push(propertiesElement);

    const extensionElements: IModdleElement = this.moddle.create('bpmn:ExtensionElements', {
      values: extensionValues,
    });
    this.businessObjInPanel.processRef.extensionElements = extensionElements;
  }

  private createEmptyCamundaProperties(): void {
    const addPropertiesElement: (element: IPropertiesElement) => number = (element: IPropertiesElement): number =>
      this.businessObjInPanel.processRef.extensionElements.values.push(element);

    const emptyProperties: Array<IProperty> = [];

    const createCamundaProperties: () => IPropertiesElement = (): IPropertiesElement =>
      this.moddle.create('camunda:Properties', {values: emptyProperties});

    addPropertiesElement(createCamundaProperties());
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
