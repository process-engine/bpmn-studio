import {IShape} from '@process-engine/bpmn-elements_contracts';
import {IViewbox} from '../index';

export interface IDiagramState {
  data: {
    xml: string;
  };
  metadata: {
    location: IViewbox;
    selectedElements: Array<IShape>;
    isChanged: boolean;
  };
}
