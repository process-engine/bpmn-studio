import {IIdentity} from '@essential-projects/iam_contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

export type SolutionStatus = 'disconnected'| 'remote'| 'singleDiagram'| 'folder';
/**
 * This entry keeps information about an opened solution. It is used to support
 * the HTML view and give an easy access to properties like the uri of the
 * solution.
 */
export interface ISolutionEntry {
  service: ISolutionExplorerService;
  uri: string;
  status: SolutionStatus;
  isSingleDiagramService: boolean;
  canCloseSolution: boolean;
  canCreateNewDiagramsInSolution: boolean;
  authority: string;
  identity: IIdentity;
  isLoggedIn: boolean;
  userName?: string;
  processEngineVersion?: string;
}
