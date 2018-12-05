import {IIdentity} from '@essential-projects/iam_contracts';
import {ISolutionExplorerService} from '@process-engine/solutionexplorer.service.contracts';

/**
 * This entry keeps information about an opened solution. It is used to support
 * the HTML view and give an easy access to properties like the uri of the
 * solution.
 */

export interface ISolutionEntry {
  service: ISolutionExplorerService;
  uri: string;
  fontAwesomeIconClass: string;
  isSingleDiagramService: boolean;
  canCloseSolution: boolean;
  canCreateNewDiagramsInSolution: boolean;
  identity: IIdentity;
  openedDiagrams?: Array<any>;
}
