import {inject} from 'aurelia-framework';

import {IShape} from '@process-engine/bpmn-elements_contracts';

import {HelpTextId, ISection} from '../../../../../../../contracts/index';
import {HelpModalService} from '../../../../../../../services/help-modal-service/help-modal-service';

@inject(HelpModalService)
export class DataObjectsSection implements ISection {
  public path: string = '/sections/data-objects/data-objects';
  public canHandleElement: boolean = false;

  private helpModalService: HelpModalService;

  constructor(helpModalService?: HelpModalService) {
    this.helpModalService = helpModalService;
  }

  public activate(): void {}

  public isSuitableForElement(element: IShape): boolean {
    if (!element) {
      return false;
    }

    return element.type === 'bpmn:DataObjectReference';
  }

  public showDataObjectsHelpModal(): void {
    this.helpModalService.showHelpModal(HelpTextId.DataObjectsUsage);
  }
}
