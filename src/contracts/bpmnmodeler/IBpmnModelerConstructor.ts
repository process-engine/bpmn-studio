import {IBpmnModeler} from './IBpmnModeler';
import {IDependencyHook} from './IDependencyHook';

export type IBpmnModelerConstructor = new (options: {
  additionalModules?: Array<IDependencyHook>;
  container?: string;
}) => IBpmnModeler;
