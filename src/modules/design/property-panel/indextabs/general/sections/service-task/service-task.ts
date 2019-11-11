import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {IPropertiesElement, IProperty, IServiceTaskElement, IShape} from '@process-engine/bpmn-elements_contracts';

import {IBpmnModdle, IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';
import {ServiceTaskService} from './components/service-task-service/service-task.service';

enum ServiceKind {
  None = 'null',
  HttpClient = 'HttpClient',
  External = 'external',
}

@inject(EventAggregator)
export class ServiceTaskSection implements ISection {
  public path: string = '/sections/service-task/service-task';
  // eslint-disable-next-line @typescript-eslint/member-naming
  public ServiceKind: typeof ServiceKind = ServiceKind;
  public canHandleElement: boolean = false;
  public businessObjInPanel: IServiceTaskElement;
  public model: IPageModel;
  public selectedKind: ServiceKind;

  private eventAggregator: EventAggregator;
  private moddle: IBpmnModdle;
  private serviceTaskService: ServiceTaskService;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    this.serviceTaskService = new ServiceTaskService(model);

    this.businessObjInPanel = model.elementInPanel.businessObject;
    this.model = model;
    this.moddle = model.modeler.get('moddle');

    this.initServiceTask();
  }

  public isSuitableForElement(element: IShape): boolean {
    return this.elementIsServiceTask(element);
  }

  public kindChanged(): void {
    const selectedKindIsHttpService: boolean = this.selectedKind === ServiceKind.HttpClient;
    const selectedKindIsExternalTask: boolean = this.selectedKind === ServiceKind.External;

    if (selectedKindIsHttpService) {
      let moduleProperty: IProperty = this.serviceTaskService.getProperty('module');
      const modulePropertyDoesNotExist: boolean = moduleProperty === undefined;

      if (modulePropertyDoesNotExist) {
        this.createModuleProperty();
      }

      moduleProperty = this.serviceTaskService.getProperty('module');
      moduleProperty.value = this.selectedKind;

      this.deleteExternalTaskProperties();
    } else if (selectedKindIsExternalTask) {
      this.businessObjInPanel.type = this.selectedKind;
      this.deleteHttpProperties();
    } else {
      this.deleteExternalTaskProperties();
      this.deleteHttpProperties();
    }

    this.publishDiagramChange();
  }

  private elementIsServiceTask(element: IShape): boolean {
    return (
      element !== undefined &&
      element.businessObject !== undefined &&
      element.businessObject.$type === 'bpmn:ServiceTask'
    );
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }

  private createModuleProperty(): void {
    if (this.serviceTaskService.extensionElementDoesNotExist) {
      this.serviceTaskService.createExtensionElement();
    }

    const noPropertiesElement: boolean = this.serviceTaskService.getPropertiesElement() === undefined;

    if (noPropertiesElement) {
      this.serviceTaskService.createPropertiesElement();
    }

    const propertiesElement: IPropertiesElement = this.serviceTaskService.getPropertiesElement();

    const modulePropertyObject: object = {
      name: 'module',
      value: 'HttpClient',
    };

    const moduleProperty: IProperty = this.moddle.create('camunda:Property', modulePropertyObject);

    propertiesElement.values.push(moduleProperty);
  }

  private initServiceTask(): void {
    const taskIsExternalTask: boolean = this.businessObjInPanel.type === 'external';

    if (taskIsExternalTask) {
      this.selectedKind = ServiceKind.External;
      return;
    }

    const modulePropertyExists: boolean = this.serviceTaskService.getProperty('module') !== undefined;
    if (modulePropertyExists) {
      this.selectedKind = ServiceKind[this.serviceTaskService.getProperty('module').value];
    } else {
      this.selectedKind = ServiceKind.None;
    }
  }

  private deleteHttpProperties(): void {
    const propertiesElement: IPropertiesElement = this.serviceTaskService.getPropertiesElement();
    const propertiesElementExists: boolean = propertiesElement !== undefined;

    if (propertiesElementExists) {
      propertiesElement.values = propertiesElement.values.filter((element: IProperty) => {
        return element.name !== 'method' && element.name !== 'params' && element.name !== 'module';
      });

      const emptyProperties: boolean = propertiesElement.values.length === 0;
      if (emptyProperties) {
        this.deletePropertiesElementAndExtensionElements();
      }
    }
  }

  private deleteExternalTaskProperties(): void {
    delete this.businessObjInPanel.type;
    delete this.businessObjInPanel.topic;

    const propertiesElement: IPropertiesElement = this.serviceTaskService.getPropertiesElement();

    if (propertiesElement) {
      propertiesElement.values = propertiesElement.values.filter((element: IProperty) => {
        return element.name !== 'payload';
      });

      const emptyProperties: boolean = propertiesElement.values.length === 0;
      if (emptyProperties) {
        this.deletePropertiesElementAndExtensionElements();
      }
    }
  }

  private deletePropertiesElementAndExtensionElements(): void {
    const indexOfPropertiesElement: number = this.businessObjInPanel.extensionElements.values.findIndex(
      (element: IPropertiesElement) => {
        if (!element) {
          return;
        }
        // eslint-disable-next-line consistent-return
        return element.$type === 'camunda:Properties';
      },
    );

    delete this.businessObjInPanel.extensionElements.values[indexOfPropertiesElement];

    const emptyExtensionElements: boolean = this.businessObjInPanel.extensionElements.values.length < 2;
    if (emptyExtensionElements) {
      delete this.businessObjInPanel.extensionElements;
    }
  }
}
