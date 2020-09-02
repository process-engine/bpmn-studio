import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';

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
export class ManualTaskSection implements ISection {
  public path: string = '/sections/manual-task/manual-task';
  public canHandleElement: boolean = false;
  @bindable public requiresConfirmation: boolean = true;

  private businessObjInPanel: IModdleElement;
  private moddle: IBpmnModdle;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    if (model == null) {
      return;
    }

    this.moddle = model.modeler.get('moddle');
    this.businessObjInPanel = model.elementInPanel.businessObject;

    const requiresConfirmationProperty: IProperty = this.getRequiresConfirmationProperty();

    if (requiresConfirmationProperty != null) {
      this.requiresConfirmation = requiresConfirmationProperty.value === 'true';
    } else {
      this.requiresConfirmation = true;
    }
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element === undefined || element.businessObject === undefined;
    if (elementHasNoBusinessObject) {
      return false;
    }

    return element.businessObject.$type === 'bpmn:ManualTask';
  }

  private createExtensionElement(): void {
    const extensionValues: Array<IModdleElement> = [];

    const extensionElements: IModdleElement = this.moddle.create('bpmn:ExtensionElements', {
      values: extensionValues,
    });

    this.businessObjInPanel.extensionElements = extensionElements;
  }

  private createPropertiesElement(): void {
    const extensionElement: IExtensionElement = this.businessObjInPanel.extensionElements;

    const properties: Array<IProperty> = [];
    const propertiesElement: IPropertiesElement = this.moddle.create('camunda:Properties', {values: properties});

    extensionElement.values.push(propertiesElement);
  }

  private getPropertiesElement(): IPropertiesElement {
    const propertiesElement: IPropertiesElement = this.businessObjInPanel.extensionElements?.values?.find(
      (element: IPropertiesElement) => {
        return element.$type === 'camunda:Properties' && element.values !== undefined;
      },
    );

    return propertiesElement;
  }

  private getRequiresConfirmationProperty(): IProperty {
    const propertiesElement: IPropertiesElement = this.getPropertiesElement();

    const property: IProperty = propertiesElement?.values?.find((element: IProperty) => {
      return element.name === 'requiresConfirmation';
    });

    return property;
  }

  private requiresConfirmationChange(): void {
    const extensionElementDoesNotExist: boolean = this.businessObjInPanel.extensionElements === undefined;
    if (extensionElementDoesNotExist) {
      this.createExtensionElement();
    }

    const propertyElementDoesNotExists: boolean = this.getPropertiesElement() === undefined;
    if (propertyElementDoesNotExists) {
      this.createPropertiesElement();
    }

    const requiresConfirmationProperty: IProperty = this.getRequiresConfirmationProperty();
    if (requiresConfirmationProperty == null) {
      const propertiesElement: IPropertiesElement = this.getPropertiesElement();

      const propertyObject: object = {
        name: 'requiresConfirmation',
        value: this.requiresConfirmation.toString(),
      };

      const property: IProperty = this.moddle.create('camunda:Property', propertyObject);

      propertiesElement.values.push(property);
    } else {
      requiresConfirmationProperty.value = this.requiresConfirmation.toString();
    }

    this.publishDiagramChange();
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
