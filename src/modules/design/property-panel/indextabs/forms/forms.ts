import {IShape} from '@process-engine/bpmn-elements_contracts';

import {IBpmnModeler, IIndextab, IPageModel, ISection} from '../../../../../contracts';
import {BasicsSection} from './sections/basics/basics';

export class Forms implements IIndextab {
  public title: string = 'Forms';
  public path: string = '/indextabs/forms/forms';
  public elementInPanel: IShape;
  public modeler: IBpmnModeler;
  public canHandleElement: boolean = false;
  public sections: Array<ISection>;

  private basicsSection: ISection = new BasicsSection();

  constructor() {
    this.sections = [this.basicsSection];
  }

  public activate(model: IPageModel): void {
    if (model === undefined) {
      return;
    }

    this.elementInPanel = model.elementInPanel;
    this.modeler = model.modeler;
  }

  public isSuitableForElement(element: IShape): boolean {
    if (element === undefined || element === null) {
      return false;
    }

    this.sections.forEach((section: ISection) => {
      section.canHandleElement = section.isSuitableForElement(element);
    });

    return this.sections.some((section: ISection) => {
      return section.canHandleElement;
    });
  }
}
