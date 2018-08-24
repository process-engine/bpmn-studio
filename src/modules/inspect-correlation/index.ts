import {FrameworkConfiguration} from 'aurelia-framework';

import {InspectCorrelationMockRepository} from './repositories/inspect-correlation.mock.repository';
import {InspectCorrelationService} from './services/inspect-correlation.service';

export function configure(config: FrameworkConfiguration): void {
  config.container.registerSingleton('InspectCorrelationRepository', InspectCorrelationMockRepository);
  config.container.registerSingleton('InspectCorrelationService', InspectCorrelationService);
}
