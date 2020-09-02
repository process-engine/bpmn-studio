/* eslint-disable no-underscore-dangle */
import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {IMessage, IMessageTask, IModdleElement, IShape} from '@process-engine/bpmn-elements_contracts';

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
export class MessageTaskSection implements ISection {
  public path: string = '/sections/message-task/message-task';
  public canHandleElement: boolean = false;
  public messages: Array<IMessage>;
  public selectedId: string;
  public selectedMessage: IMessage;

  private businessObjInPanel: IMessageTask;
  private linter: ILinting;
  private moddle: IBpmnModdle;
  private modeler: IBpmnModeler;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    if (model == null) {
      return;
    }

    this.businessObjInPanel = model.elementInPanel.businessObject;

    this.moddle = model.modeler.get('moddle');
    this.modeler = model.modeler;
    this.linter = model.modeler.get('linting');

    this.messages = await this.getMessages();

    this.init();
  }

  public isSuitableForElement(element: IShape): boolean {
    return this.elementIsMessageTask(element);
  }

  public updateMessage(): void {
    this.selectedMessage = this.messages.find((message: IMessage) => {
      return message.id === this.selectedId;
    });

    this.businessObjInPanel.messageRef = this.selectedMessage;
    this.publishDiagramChange();

    if (this.linter.lintingActive()) {
      this.linter.update();
    }
  }

  public updateName(): void {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;
    const selectedMessage: IMessage = rootElements.find((element: IModdleElement) => {
      const elementIsSelectedMessage: boolean = element.$type === 'bpmn:Message' && element.id === this.selectedId;

      return elementIsSelectedMessage;
    });

    selectedMessage.name = this.selectedMessage.name;
    this.publishDiagramChange();
  }

  public async addMessage(): Promise<void> {
    const bpmnMessageProperty: {id: string; name: string} = {
      id: `Message_${generateRandomId()}`,
      name: 'Message Name',
    };
    const bpmnMessage: IMessage = this.moddle.create('bpmn:Message', bpmnMessageProperty);

    this.modeler._definitions.rootElements.push(bpmnMessage);

    const {xml: xmlStrUpdated} = await this.moddle.toXML(this.modeler._definitions);

    await this.modeler.importXML(xmlStrUpdated);
    await this.refreshMessages();
    this.setBusinessObj();

    this.selectedId = bpmnMessage.id;
    this.updateMessage();

    this.publishDiagramChange();
  }

  public removeSelectedMessage(): void {
    const noMessageIsSelected: boolean = !this.selectedId;
    if (noMessageIsSelected) {
      return;
    }

    const messageIndex: number = this.messages.findIndex((message: IMessage) => {
      return message.id === this.selectedId;
    });

    this.messages.splice(messageIndex, 1);
    this.modeler._definitions.rootElements.splice(this.getRootElementsIndex(this.selectedId), 1);

    this.updateMessage();
    this.publishDiagramChange();
  }

  private getRootElementsIndex(elementId: string): number {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;

    const rootElementsIndex: number = rootElements.findIndex((element: IModdleElement) => {
      return element.id === elementId;
    });

    return rootElementsIndex;
  }

  private elementIsMessageTask(element: IShape): boolean {
    return element !== undefined && (element.type === 'bpmn:SendTask' || element.type === 'bpmn:ReceiveTask');
  }

  private init(): void {
    const businessObjectHasNoMessageEvents: boolean =
      this.businessObjInPanel === undefined || this.businessObjInPanel.messageRef === undefined;
    if (businessObjectHasNoMessageEvents) {
      this.selectedMessage = undefined;
      this.selectedId = undefined;

      return;
    }

    const messageRef: IMessage = this.businessObjInPanel.messageRef;
    const messageId: string = messageRef.id;
    const elementReferencesMessage: boolean = this.getMessageById(messageId) !== undefined;

    if (elementReferencesMessage) {
      this.selectedId = messageId;
      this.updateMessage();
    } else {
      this.selectedMessage = undefined;
      this.selectedId = undefined;
    }
  }

  private getMessageById(messageId: string): IMessage {
    const messages: Array<IMessage> = this.getMessages();
    const message: IMessage = messages.find((messageElement: IMessage) => {
      return messageElement.id === messageId;
    });

    return message;
  }

  private getMessages(): Array<IMessage> {
    const rootElements: Array<IModdleElement> = this.modeler._definitions.rootElements;
    const messages: Array<IMessage> = rootElements.filter((element: IModdleElement) => {
      return element.$type === 'bpmn:Message';
    });

    return messages;
  }

  private async refreshMessages(): Promise<void> {
    this.messages = await this.getMessages();
  }

  private setBusinessObj(): void {
    const elementRegistry: IElementRegistry = this.modeler.get('elementRegistry');
    const elementInPanel: IShape = elementRegistry.get(this.businessObjInPanel.id);

    this.businessObjInPanel = elementInPanel.businessObject;
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
