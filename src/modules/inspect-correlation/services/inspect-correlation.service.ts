import {inject} from 'aurelia-framework';

import {Correlation} from '@process-engine/management_api_contracts';

import {IInspectCorrelationRepository, IInspectCorrelationService} from '../contracts';

@inject('InspectCorrelationRepository')
export class InspectCorrelationService implements IInspectCorrelationService {
  private _inspectCorrelationRepository: IInspectCorrelationRepository;

  constructor(inspectCorrelationRepository: IInspectCorrelationRepository) {
    this._inspectCorrelationRepository = inspectCorrelationRepository;
  }

  public getAllCorrelationsForProcessModelId(processModelId: string): Promise<Array<Correlation>> {
    return this._inspectCorrelationRepository.getAllCorrelationsForProcessModelId(processModelId);
  }
}
