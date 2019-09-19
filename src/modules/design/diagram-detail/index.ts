import {FrameworkConfiguration} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {DiagramDetailService} from './service/diagram-detail.service';

export function configure(config: FrameworkConfiguration): void {
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);
  const managementApiClient: IManagementApiClient = config.container.get('ManagementApiClientService');

  const diagramDetailService: DiagramDetailService = new DiagramDetailService(eventAggregator, managementApiClient);

  config.container.registerInstance('DiagramDetailService', diagramDetailService);
}
