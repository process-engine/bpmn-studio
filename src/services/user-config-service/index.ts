import {FrameworkConfiguration} from 'aurelia-framework';
import {UserConfigService} from './user-config.service';

export function configure(config: FrameworkConfiguration): void {
  config.container.registerSingleton('UserConfigService', UserConfigService);
}
