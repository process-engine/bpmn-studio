import {FrameworkConfiguration} from 'aurelia-framework';

import {IManagementApiClient} from '@process-engine/management_api_contracts';
import {EventAggregator} from 'aurelia-event-aggregator';
import {HeatmapService} from './services/heatmap.service';
import {IHeatmapService} from './contracts';

export function configure(config: FrameworkConfiguration): void {
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);

  const managementApiClient: IManagementApiClient = config.container.get('ManagementApiClientService');

  const heatmapService: IHeatmapService = new HeatmapService(eventAggregator, managementApiClient);

  config.container.registerInstance('HeatmapService', heatmapService);
}
