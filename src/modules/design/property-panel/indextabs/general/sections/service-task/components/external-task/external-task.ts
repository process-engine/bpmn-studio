import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';

import {IProperty, IServiceTaskElement} from '@process-engine/bpmn-elements_contracts';

import {IPageModel} from '../../../../../../../../../contracts';
import environment from '../../../../../../../../../environment';
import {ServiceTaskService} from '../service-task-service/service-task.service';

@inject(EventAggregator)
export class ExternalTask {
  @bindable() public model: IPageModel;
  public businessObjInPanel: IServiceTaskElement;
  public selectedTopic: string;
  public selectedPayload: string;
  public showModal: boolean = false;

  public payloadInput: HTMLElement;

  private eventAggregator: EventAggregator;
  private serviceTaskService: ServiceTaskService;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public attached(): void {
    this.recoverInputHeight();

    this.saveInputHeightOnChange();
  }

  public detached(): void {
    this.payloadInput.removeEventListener('mousedown', this.saveInputHeightOnMouseUp);
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

  private saveInputHeightOnChange(): void {
    this.payloadInput.addEventListener('mousedown', this.saveInputHeightOnMouseUp);
  }

  private recoverInputHeight(): void {
    this.payloadInput.style.height = `${localStorage.getItem('externalTaskPayloadInputHeight')}px`;
  }

  private saveInputHeightOnMouseUp: EventListenerOrEventListenerObject = () => {
    const resizeListenerFunction: EventListenerOrEventListenerObject = (): void => {
      localStorage.setItem('externalTaskPayloadInputHeight', this.payloadInput.clientHeight.toString());
      window.removeEventListener('mouseup', resizeListenerFunction);
    };
    window.addEventListener('mouseup', resizeListenerFunction);
  };

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
