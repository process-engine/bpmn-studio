import {IBpmnXmlSaveOptions} from './IBpmnXmlSaveOptions';

export interface IBpmnModeler {
  _definitions: any;
  attachTo(dom: HTMLElement): void;
  clear(): void;
  detach(): void;
  destroy(): void;
  saveXML(options: IBpmnXmlSaveOptions): Promise<any>;
  saveSVG(options: object): Promise<any>;
  importXML(xml: string): Promise<any>;
  get(object: string): any;
  on(event: string | Array<string>, callback: Function, priority?: number): void;
  off(event: string | Array<string>, callback: Function): void;
}
