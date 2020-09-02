import {EventAggregator} from 'aurelia-event-aggregator';
import {inject, observable} from 'aurelia-framework';

import {ILinkEventElement, IShape} from '@process-engine/bpmn-elements_contracts';

import {IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';

@inject(EventAggregator)
export class LinkEventSection implements ISection {
  public path: string = '/sections/link-event/link-event';
  public canHandleElement: boolean = false;
  @observable public linkEventName: string = '';

  private businessObjInPanel: ILinkEventElement;
  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    if (model == null) {
      return;
    }

    this.businessObjInPanel = model.elementInPanel.businessObject as ILinkEventElement;
    this.linkEventName = this.businessObjInPanel.eventDefinitions[0].name || '';
  }

  public isSuitableForElement(elementShape: IShape): boolean {
    const elementHasNoBusinessObject: boolean = elementShape === undefined || elementShape.businessObject === undefined;
    if (elementHasNoBusinessObject) {
      return false;
    }

    const eventElement: ILinkEventElement = elementShape.businessObject as ILinkEventElement;

    const elementIsLinkEvent: boolean =
      eventElement.eventDefinitions !== undefined &&
      eventElement.eventDefinitions[0] !== undefined &&
      eventElement.eventDefinitions[0].$type === 'bpmn:LinkEventDefinition';

    return elementIsLinkEvent;
  }

  public linkEventNameChanged(newValue, oldValue): void {
    if (oldValue === undefined) {
      return;
    }

    this.businessObjInPanel.eventDefinitions[0].name = newValue;
    this.publishDiagramChange();
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
