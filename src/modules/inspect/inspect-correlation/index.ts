import {FrameworkConfiguration} from 'aurelia-framework';

import {InspectCorrelationService} from './services/inspect-correlation.service';

export function configure(config: FrameworkConfiguration): void {
  config.container.registerSingleton('InspectCorrelationService', InspectCorrelationService);
}
