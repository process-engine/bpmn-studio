import {Correlation} from '@process-engine/management_api_contracts';

export interface IInspectCorrelationService {
  getAllCorrelationsForProcessModelId(processModelId: string): Promise<Array<Correlation>>;
}
