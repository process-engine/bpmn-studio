import {FrameworkConfiguration} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {TokenViewerService} from './service/token-viewer.service';

export function configure(config: FrameworkConfiguration): void {
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);
  const managementApiClient: IManagementApiClient = config.container.get('ManagementApiClientService');

  const tokenViewerService: TokenViewerService = new TokenViewerService(eventAggregator, managementApiClient);

  config.container.registerInstance('TokenViewerService', tokenViewerService);
}
