import {FrameworkConfiguration} from 'aurelia-framework';
import {ProcessEngineVersionService} from './process-engine-version-service';

export function configure(config: FrameworkConfiguration): void {
  config.container.registerSingleton('ProcessEngineVersionService', ProcessEngineVersionService);
}
