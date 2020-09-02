import {IShape} from '@process-engine/bpmn-elements_contracts';

import {IBpmnModeler, IIndextab, IPageModel, ISection} from '../../../../../contracts';
import {BasicsSection} from './sections/basics/basics';
import {ProcessSection} from './sections/process/process';

export class Extensions implements IIndextab {
  public title: string = 'Extensions';
  public path: string = '/indextabs/extensions/extensions';
  public modeler: IBpmnModeler;
  public elementInPanel: IShape;
  public canHandleElement: boolean = true;
  public sections: Array<ISection>;

  private basicsSection: ISection = new BasicsSection();
  private processSection: ISection = new ProcessSection();

  constructor() {
    this.sections = [this.basicsSection, this.processSection];
  }

  public activate(model: IPageModel): void {
    /*
     * This is necessary because since v1.12.0 of aurelia-templating-resources there is a bug
     * which triggers the activate function although the form section is already detached.
     */
    if (model == null) {
      return;
    }

    this.elementInPanel = model.elementInPanel;
    this.modeler = model.modeler;
  }

  public isSuitableForElement(element: IShape): boolean {
    if (element == null) {
      return false;
    }

    this.sections.forEach((section: ISection) => {
      section.canHandleElement = section.isSuitableForElement(element);
    });

    return this.sections.some((section: ISection) => {
      return section.isSuitableForElement(element);
    });
  }
}
