import {FrameworkConfiguration} from 'aurelia-framework';

import {IManagementApiClient} from '@process-engine/management_api_contracts';
import {EventAggregator} from 'aurelia-event-aggregator';
import {DashboardService} from './dashboard-service/dashboard-service';

export function configure(config: FrameworkConfiguration): void {
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);
  const managementApiClient: IManagementApiClient = config.container.get('ManagementApiClientService');

  const dashboardService: DashboardService = new DashboardService(eventAggregator, managementApiClient);

  config.container.registerInstance('DashboardService', dashboardService);
}
