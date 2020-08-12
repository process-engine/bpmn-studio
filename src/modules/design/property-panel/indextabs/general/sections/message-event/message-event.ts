/* eslint-disable no-underscore-dangle */
import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {
  IEventElement,
  IMessage,
  IMessageEventDefinition,
  IMessageEventElement,
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
export class MessageEventSection implements ISection {
  public path: string = '/sections/message-event/message-event';
  public canHandleElement: boolean = false;
  public messages: Array<IMessage>;
  public selectedId: string;
  public selectedMessage: IMessage;

  private businessObjInPanel: IMessageEventElement;
  private moddle: IBpmnModdle;
  private modeler: IBpmnModeler;
  private linter: ILinting;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public async activate(model: IPageModel): Promise<void> {
    this.businessObjInPanel = model.elementInPanel.businessObject as IMessageEventElement;

    this.moddle = model.modeler.get('moddle');
    this.modeler = model.modeler;
    this.linter = model.modeler.get('linting');

    this.messages = await this.getMessages();

    this.init();
  }

  public isSuitableForElement(element: IShape): boolean {
    return this.elementIsMessageEvent(element);
  }

  public updateMessage(): void {
    this.selectedMessage = this.messages.find((message: IMessage) => {
      return message.id === this.selectedId;
    });

    const messageEventDefinition: IMessageEventDefinition = this.businessObjInPanel
      .eventDefinitions[0] as IMessageEventDefinition;
    messageEventDefinition.messageRef = this.selectedMessage;
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
    await this.setBusinessObj();

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

  private elementIsMessageEvent(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element === undefined || element.businessObject === undefined;
    if (elementHasNoBusinessObject) {
      return false;
    }

    const eventElement: IEventElement = element.businessObject as IEventElement;

    const elementIsMessageEvent: boolean =
      eventElement.eventDefinitions !== undefined &&
      eventElement.eventDefinitions[0] !== undefined &&
      eventElement.eventDefinitions[0].$type === 'bpmn:MessageEventDefinition';

    return elementIsMessageEvent;
  }

  private init(): void {
    const eventDefinitions: Array<IMessageEventDefinition> = this.businessObjInPanel.eventDefinitions;
    const businessObjectHasNoMessageEvents: boolean =
      eventDefinitions === undefined ||
      eventDefinitions === null ||
      eventDefinitions[0].$type !== 'bpmn:MessageEventDefinition';
    if (businessObjectHasNoMessageEvents) {
      return;
    }

    const messageEventDefinition: IMessageEventDefinition = this.businessObjInPanel.eventDefinitions[0];
    const elementHasNoMessageRef: boolean = messageEventDefinition.messageRef === undefined;

    if (elementHasNoMessageRef) {
      this.selectedMessage = null;
      this.selectedId = null;

      return;
    }

    const messageRefId: string = messageEventDefinition.messageRef.id;
    const elementReferencesMessage: boolean = this.getMessageById(messageRefId) !== undefined;

    if (elementReferencesMessage) {
      this.selectedId = messageRefId;

      this.selectedMessage = this.messages.find((message: IMessage) => {
        return message.id === this.selectedId;
      });
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

    this.businessObjInPanel = elementInPanel.businessObject as IMessageEventElement;
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
