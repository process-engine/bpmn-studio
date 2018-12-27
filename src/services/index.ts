import {FrameworkConfiguration} from 'aurelia-framework';

import {ConfigService} from './ConfigService';
import {SolutionService} from './SolutionService';

export async function configure(config: FrameworkConfiguration): Promise<void> {

  config.container.registerSingleton('SolutionService', SolutionService);
  config.container.registerSingleton('ConfigService', ConfigService);
}
