import {FrameworkConfiguration} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {InspectProcessInstanceService} from './services/inspect-process-instance.service';

export function configure(config: FrameworkConfiguration): void {
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);
  const managementApiClient: IManagementApiClient = config.container.get('ManagementApiClientService');

  const inspectProcessInstanceService: InspectProcessInstanceService = new InspectProcessInstanceService(
    eventAggregator,
    managementApiClient,
  );

  config.container.registerInstance('InspectProcessInstanceService', inspectProcessInstanceService);
}
