import {IShape} from '@process-engine/bpmn-elements_contracts';

import {ISection} from './ISection';

export interface IIndextab {
  title: string;
  path: string;
  canHandleElement: boolean;
  sections: Array<ISection>;
  isSuitableForElement(element: IShape): boolean;
}
