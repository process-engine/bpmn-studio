import {IDiagram} from '@process-engine/solutionexplorer.contracts';
import {ISolutionEntry} from '../solution-explorer';

export type DeployResult = {
  diagram: IDiagram;
  solution: ISolutionEntry;
};
