import {FrameworkConfiguration} from 'aurelia-framework';

import {SolutionService} from './solution.service';

export async function configure(config: FrameworkConfiguration): Promise<void> {
  config.container.registerSingleton('SolutionService', SolutionService);
}
