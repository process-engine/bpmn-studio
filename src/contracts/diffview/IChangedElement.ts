import {IModdleElement} from '@process-engine/bpmn-elements_contracts';

export interface IChangedElement {
  attrs: object;
  model: IModdleElement;
}
