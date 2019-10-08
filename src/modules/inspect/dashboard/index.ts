import {FrameworkConfiguration} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';

import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {IDashboardService} from './contracts';
import {DashboardService} from './services/dashboard.service';

export function configure(config: FrameworkConfiguration): void {
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);
  const managementApiClient: IManagementApiClient = config.container.get('ManagementApiClientService');

  const dashboardService: IDashboardService = new DashboardService(eventAggregator, managementApiClient);

  config.container.registerInstance('DashboardService', dashboardService);
}
