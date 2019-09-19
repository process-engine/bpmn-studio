import {FrameworkConfiguration} from 'aurelia-framework';

import {EventAggregator} from 'aurelia-event-aggregator';
import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {LiveExecutionTrackerService} from './services/live-execution-tracker.service';

export function configure(config: FrameworkConfiguration): void {
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);
  const managementApiClient: IManagementApiClient = config.container.get('ManagementApiClientService');

  const liveExecutionTrackerService: LiveExecutionTrackerService = new LiveExecutionTrackerService(
    eventAggregator,
    managementApiClient,
  );

  config.container.registerInstance('LiveExecutionTrackerService', liveExecutionTrackerService);
}
