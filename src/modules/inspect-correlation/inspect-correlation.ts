import {inject} from 'aurelia-framework';

import {Correlation} from '@process-engine/management_api_contracts';

import {IInspectCorrelationService} from './contracts';

interface RouteParameters {
  processModelId: string;
}

@inject('InspectCorrelationService')
export class InspectCorrelation {
  public processModelCorrelations: Array<Correlation>;
  private _inspectCorrelationService: IInspectCorrelationService;

  constructor(inspectCorrelationService: IInspectCorrelationService) {
    this._inspectCorrelationService = inspectCorrelationService;
  }

  public async activate(routeParameters: RouteParameters): Promise<void> {
    const processModelId: string = routeParameters.processModelId;

    this.processModelCorrelations = await this._inspectCorrelationService.getAllCorrelationsForProcessModelId(processModelId);
    console.log(this.processModelCorrelations);
  }
}
