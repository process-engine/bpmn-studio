import {DataModels} from '@process-engine/management_api_contracts';

export interface IProcessInstanceWithCorrelation {
  processInstance: DataModels.Correlations.ProcessInstance;
  correlation: DataModels.Correlations.Correlation;
}
