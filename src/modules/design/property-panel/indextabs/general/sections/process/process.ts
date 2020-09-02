import {EventAggregator} from 'aurelia-event-aggregator';
import {inject} from 'aurelia-framework';

import {IModdleElement, IShape} from '@process-engine/bpmn-elements_contracts';

import {IPageModel, ISection} from '../../../../../../../contracts';
import environment from '../../../../../../../environment';

@inject(EventAggregator)
export class ProcessSection implements ISection {
  public path: string = '/sections/process/process';
  public canHandleElement: boolean = false;
  public businessObjInPanel: any;

  private eventAggregator: EventAggregator;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public activate(model: IPageModel): void {
    if (model == null) {
      return;
    }

    this.businessObjInPanel = model.elementInPanel.businessObject.processRef;
  }

  public isSuitableForElement(element: IShape): boolean {
    const elementHasNoBusinessObject: boolean = element === undefined || element.businessObject === undefined;
    if (elementHasNoBusinessObject) {
      return false;
    }

    const elementIsRoot: boolean = element.businessObject.$type === 'bpmn:Participant';

    return elementIsRoot;
  }

  public toggleExecutable(): void {
    this.publishDiagramChange();
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }
}
