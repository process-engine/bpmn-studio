import {IDiagram} from '@process-engine/solutionexplorer.contracts';

export type FeedbackData = {
  bugs: string;
  suggestions: string;
  diagrams: Array<IDiagram>;
  additionalDiagramInformation: string;
  attachInternalDatabases: boolean;
};
