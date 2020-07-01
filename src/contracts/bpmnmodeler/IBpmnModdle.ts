import {IModdleElement} from '@process-engine/bpmn-elements_contracts';

import {IDefinition, IIds} from './index';

export interface IBpmnModdle {
  ids: IIds;
  fromXML(xml: string): Promise<any>;
  create(name: string, attributes: object): IModdleElement;
  toXML(definitions: IDefinition): Promise<any>;
}
