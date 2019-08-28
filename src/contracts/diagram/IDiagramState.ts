import {IShape} from '@process-engine/bpmn-elements_contracts';
import {DiagramStateChange, IViewbox} from '../index';

export interface IDiagramState {
  data: {
    xml: string;
  };
  metadata: {
    location: IViewbox;
    selectedElements: Array<IShape>;
    changes?: Array<DiagramStateChange>;
    isChanged: boolean;
  };
}
