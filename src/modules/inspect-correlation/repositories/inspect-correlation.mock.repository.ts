import {Correlation} from '@process-engine/management_api_contracts';

import {IInspectCorrelationRepository} from '../contracts';

export class InspectCorrelationMockRepository implements IInspectCorrelationRepository {

  private _mockCorrelations: Array<Correlation> = [
    {
      id: 'heatmapSample',
      processModelId: 'heatmap_sample',
    },
    {
      id: 'heatmapSample2',
      processModelId: 'heatmap_sample',
    },
    {
      id: 'heatmapSample3',
      processModelId: 'knaskdjnjfdsada',
    },
    {
      id: 'heatmapSample4',
      processModelId: '123124142',
    },
    {
      id: 'heatmapSample5',
      processModelId: 'adalmvdfff',
    },
    {
      id: 'heatmapSample6',
      processModelId: 'test',
    },
    {
      id: 'heatmapSample7',
      processModelId: 'delgre123',
    },
    {
      id: 'heatmapSample8',
      processModelId: 'asldkvfd',
    },
    {
      id: 'heatmapSample9',
      processModelId: 'cdcdsafsd',
    },
    {
      id: 'heatmapSample10',
      processModelId: 'ok',
    },
  ];

  public getAllCorrelationsForProcessModelId(processModelId: string): Promise<Array<Correlation>> {
    const correlationsForProcessModelId: Array<Correlation> = this._mockCorrelations.filter((correlation: Correlation) => {
      return correlation.processModelId === processModelId;
    });

    return new Promise((resolve: Function): void => {
      resolve(correlationsForProcessModelId);
    });
  }
}
