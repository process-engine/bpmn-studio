import {Correlation} from '@process-engine/management_api_contracts';

export interface IInspectCorrelationRepository {
  getAllCorrelationsForProcessModelId(processModelId: string): Promise<Array<Correlation>>;
}
