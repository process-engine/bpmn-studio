import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {
  IExtensionElement,
  IModdleElement,
  IPropertiesElement,
  IProperty,
  IShape,
} from '@process-engine/bpmn-elements_contracts';

import {IBpmnModdle, IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';

@inject(EventAggregator)
export class BasicsSection implements ISection {
  public path: string = '/sections/basics/basics';
  public canHandleElement: boolean = false;
  public properties: Array<IProperty> = [];
  public newNames: Array<string> = [];
  public newValues: Array<string> = [];
  public shouldFocus: boolean = false;

  private businessObjInPanel: IModdleElement;
  private moddle: IBpmnModdle;
  private propertiesElement: IPropertiesElement;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    if (model == null) {
      return;
    }

    this.businessObjInPanel = model.elementInPanel.businessObject;
    this.moddle = model.modeler.get('moddle');
    this.reloadProperties();
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementIsUndefined: boolean = element === undefined || element.businessObject === undefined;

    if (elementIsUndefined) {
      return false;
    }

    const elementHasExtensions: boolean =
      element.businessObject.$type !== 'bpmn:Process' && element.businessObject.$type !== 'bpmn:Collaboration';

    return elementHasExtensions;
  }

  public addProperty(): void {
    this.reloadProperties();

    const bpmnPropertyProperties: object = {
      name: '',
      value: '',
    };
    const bpmnProperty: IProperty = this.moddle.create('camunda:Property', bpmnPropertyProperties);

    this.newNames.push('');
    this.newValues.push('');

    const businessObjectHasNoExtensionElements: boolean =
      this.businessObjInPanel.extensionElements === undefined ||
      this.businessObjInPanel.extensionElements === null ||
      this.businessObjInPanel.extensionElements.values === undefined ||
      this.businessObjInPanel.extensionElements.values.length === 0;

    if (businessObjectHasNoExtensionElements) {
      this.createExtensionElement();
    }

    this.propertiesElement = this.getPropertiesElement();
    const propertiesElementIsUndefined: boolean = this.propertiesElement === undefined;

    if (propertiesElementIsUndefined) {
      this.createEmptyCamundaProperties();
      this.propertiesElement = this.getPropertiesElement();
    }

    this.propertiesElement.values.push(bpmnProperty);
    this.properties.push(bpmnProperty);
    this.publishDiagramChange();
    this.shouldFocus = true;
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

  public removeProperty(index: number): void {
    this.propertiesElement.values.splice(index, 1);

    const emptyProperties: boolean = this.propertiesElement.values.length === 0;
    if (emptyProperties) {
      this.deletePropertiesElementAndExtensionElements();
    }

    this.reloadProperties();
    this.publishDiagramChange();
  }

  public changeName(index: number): void {
    this.propertiesElement.values[index].name = this.newNames[index];
    this.checkAndRemoveEmptyProperties(index);

    this.publishDiagramChange();
  }

  public changeValue(index: number): void {
    this.propertiesElement.values[index].value = this.newValues[index];
    this.checkAndRemoveEmptyProperties(index);

    this.publishDiagramChange();
  }

  private deletePropertiesElementAndExtensionElements(): void {
    const indexOfPropertiesElement: number = this.businessObjInPanel.extensionElements.values.findIndex(
      (element: IPropertiesElement) => {
        if (!element) {
          return undefined;
        }
        return element.$type === 'camunda:Properties';
      },
    );

    delete this.businessObjInPanel.extensionElements.values[indexOfPropertiesElement];

    const emptyExtensionElements: boolean = this.businessObjInPanel.extensionElements.values.length < 2;
    if (emptyExtensionElements) {
      delete this.businessObjInPanel.extensionElements;
    }
  }

  private checkAndRemoveEmptyProperties(index: number): void {
    const propertyElement: IProperty = this.propertiesElement.values[index];
    if (!propertyElement) {
      return;
    }

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
      this.businessObjInPanel.extensionElements === undefined ||
      this.businessObjInPanel.extensionElements === null ||
      this.businessObjInPanel.extensionElements.values === undefined ||
      this.businessObjInPanel.extensionElements.values.length === 0;

    if (businessObjectHasNoExtensionElements) {
      return;
    }

    const extensionsPropertiesElement: IPropertiesElement = this.businessObjInPanel.extensionElements.values.find(
      (extensionValue: IExtensionElement) => {
        if (!extensionValue) {
          return undefined;
        }

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

    this.propertiesElement = extensionsPropertiesElement;

    const properties: Array<IProperty> = extensionsPropertiesElement.values;
    for (const property of properties) {
      if (property.$type !== 'camunda:Property') {
        continue;
      }
      this.newNames.push(property.name);
      this.newValues.push(property.value);
      this.properties.push(property);
    }
  }

  private getPropertiesElement(): IPropertiesElement | undefined {
    const businessObjectHasNoExtensionElements: boolean =
      this.businessObjInPanel.extensionElements === undefined ||
      this.businessObjInPanel.extensionElements === null ||
      this.businessObjInPanel.extensionElements.values === undefined ||
      this.businessObjInPanel.extensionElements.values.length === 0;

    if (businessObjectHasNoExtensionElements) {
      return undefined;
    }

    const propertiesElement: IPropertiesElement = this.businessObjInPanel.extensionElements.values.find(
      (extensionValue: IExtensionElement) => {
        if (!extensionValue) {
          return undefined;
        }

        const extensionIsPropertiesElement: boolean =
          extensionValue.$type === 'camunda:Properties' &&
          extensionValue.values !== undefined &&
          extensionValue.values !== null;

        return extensionIsPropertiesElement;
      },
    );

    return propertiesElement;
  }

  private createExtensionElement(): void {
    const extensionValues: Array<IModdleElement> = [];
    const properties: Array<IProperty> = [];
    const propertiesElement: IPropertiesElement = this.moddle.create('camunda:Properties', {values: properties});
    extensionValues.push(propertiesElement);

    const extensionElements: IModdleElement = this.moddle.create('bpmn:ExtensionElements', {
      values: extensionValues,
    });
    this.businessObjInPanel.extensionElements = extensionElements;
  }

  private createEmptyCamundaProperties(): void {
    const addPropertiesElement: (element: IPropertiesElement) => number = (element: IPropertiesElement): number =>
      this.businessObjInPanel.extensionElements.values.push(element);

    const emptyProperties: Array<IProperty> = [];

    const createCamundaProperties: () => IPropertiesElement = (): IPropertiesElement =>
      this.moddle.create('camunda:Properties', {values: emptyProperties});

    addPropertiesElement(createCamundaProperties());
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
