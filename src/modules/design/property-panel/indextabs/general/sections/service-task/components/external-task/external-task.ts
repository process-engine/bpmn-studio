import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';

import {IProperty, IServiceTaskElement} from '@process-engine/bpmn-elements_contracts';

import {IPageModel} from '../../../../../../../../../contracts';
import environment from '../../../../../../../../../environment';
import {ServiceTaskService} from '../service-task-service/service-task-service';

@inject(EventAggregator)
export class ExternalTask {
  @bindable() public model: IPageModel;
  public businessObjInPanel: IServiceTaskElement;
  public selectedTopic: string;
  public selectedPayload: string;
  public showModal: boolean = false;

  private eventAggregator: EventAggregator;
  private serviceTaskService: ServiceTaskService;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public modelChanged(): void {
    this.serviceTaskService = new ServiceTaskService(this.model);
    this.businessObjInPanel = this.model.elementInPanel.businessObject;

    this.selectedTopic = this.businessObjInPanel.topic;
    this.selectedPayload = this.getPayloadFromModel();
  }

  public topicChanged(): void {
    this.businessObjInPanel.topic = this.selectedTopic;

    this.publishDiagramChange();
  }

  public payloadChanged(): void {
    this.setPayloadToModel(this.selectedPayload);

    this.publishDiagramChange();
  }

  private getPayloadFromModel(): string | undefined {
    const payloadProperty: IProperty = this.serviceTaskService.getProperty('payload');

    const payloadPropertyExists: boolean = payloadProperty !== undefined;
    if (payloadPropertyExists) {
      return payloadProperty.value;
    }
    return undefined;
  }

  private setPayloadToModel(value: string): void {
    let payloadProperty: IProperty = this.serviceTaskService.getProperty('payload');

    const payloadPropertyNotExists: boolean = payloadProperty === undefined;

    if (payloadPropertyNotExists) {
      payloadProperty = this.serviceTaskService.createProperty('payload');
    }

    payloadProperty.value = value;
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
