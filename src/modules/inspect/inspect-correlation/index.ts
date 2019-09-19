import {FrameworkConfiguration} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {InspectCorrelationService} from './services/inspect-correlation.service';

export function configure(config: FrameworkConfiguration): void {
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);
  const managementApiClient: IManagementApiClient = config.container.get('ManagementApiClientService');

  const inspectCorrelationService: InspectCorrelationService = new InspectCorrelationService(
    eventAggregator,
    managementApiClient,
  );

  config.container.registerInstance('InspectCorrelationService', inspectCorrelationService);
}
