import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {
  IExtensionElement,
  IModdleElement,
  IPropertiesElement,
  IProperty,
  IScriptTaskElement,
  IShape,
} from '@process-engine/bpmn-elements_contracts';
import {IBpmnModdle} from '../../../../../../../../contracts/bpmnmodeler/IBpmnModdle';

import {HelpTextId, IPageModel, ISection} from '../../../../../../../../contracts/index';
import environment from '../../../../../../../../environment';
import {HelpModalService} from '../../../../../../../../services/help-modal-service/help-modal-service';

@inject(EventAggregator, HelpModalService)
export class DataOutputAssociationSection implements ISection {
  public path: string = '/sections/data-objects/data-output-association/data-output-association';
  public canHandleElement: boolean = false;
  public businessObjInPanel: IScriptTaskElement;

  public showModal: boolean = false;

  public dataSourceInput: HTMLElement;
  public dataSource: string;

  private eventAggregator: EventAggregator;
  private helpModalService: HelpModalService;
  private moddle: IBpmnModdle;

  constructor(eventAggregator?: EventAggregator, helpModalService?: HelpModalService) {
    this.eventAggregator = eventAggregator;
    this.helpModalService = helpModalService;
  }

  public activate(model: IPageModel): void {
    this.moddle = model.modeler.get('moddle');

    this.businessObjInPanel = model.elementInPanel.businessObject;
    const dataSourceProperty = this.getDataSourceProperty();

    this.dataSource = dataSourceProperty?.value ?? '';
  }

  public attached(): void {
    this.recoverInputHeight();

    this.saveInputHeightOnChange();
  }

  public detached(): void {
    this.dataSourceInput.removeEventListener('mousedown', this.saveInputHeightOnMouseUp);
  }

  public isSuitableForElement(element: IShape): boolean {
    if (!element) {
      return false;
    }

    return element.type === 'bpmn:DataOutputAssociation';
  }

  public updateDataSource(): void {
    this.publishDiagramChange();

    const dataSourceProperty = this.getDataSourceProperty();
    if (dataSourceProperty != null) {
      dataSourceProperty.value = this.dataSource;
    } else {
      const extensionElementDoesNotExist = this.businessObjInPanel.extensionElements === undefined;
      if (extensionElementDoesNotExist) {
        this.createExtensionElement();
      }

      const propertyElementDoesNotExists =
        this.businessObjInPanel.extensionElements.values.find(
          (extensionElement) => extensionElement.$type === 'camunda:Properties',
        ) == null;

      if (propertyElementDoesNotExists) {
        this.createPropertiesElement();
      }

      const propertyObject: object = {
        name: 'dataSource',
        value: this.dataSource,
      };

      const property: IProperty = this.moddle.create('camunda:Property', propertyObject);

      const propertiesElement = this.businessObjInPanel.extensionElements.values.find(
        (extensionElement) => extensionElement.$type === 'camunda:Properties',
      );

      propertiesElement.values.push(property);
    }
  }

  public showDataObjectsHelpModal(): void {
    this.helpModalService.showHelpModal(HelpTextId.DataObjectsUsage);
  }

  private getDataSourceProperty(): IProperty {
    const dataSourceProperty = this.businessObjInPanel.extensionElements?.values
      ?.find((extensionElement) => {
        return extensionElement.$type === 'camunda:Properties';
      })
      ?.values?.find((property) => {
        return property.name === 'dataSource';
      });

    return dataSourceProperty;
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

  private saveInputHeightOnChange(): void {
    this.dataSourceInput.addEventListener('mousedown', this.saveInputHeightOnMouseUp);
  }

  private recoverInputHeight(): void {
    this.dataSourceInput.style.height = `${localStorage.getItem('dataSourceInputHeight')}px`;
  }

  private saveInputHeightOnMouseUp: EventListenerOrEventListenerObject = () => {
    const resizeListenerFunction: EventListenerOrEventListenerObject = (): void => {
      localStorage.setItem('dataSourceInputHeight', this.dataSourceInput.clientHeight.toString());
      window.removeEventListener('mouseup', resizeListenerFunction);
    };
    window.addEventListener('mouseup', resizeListenerFunction);
  };

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
