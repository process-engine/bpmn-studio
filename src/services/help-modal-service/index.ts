import {FrameworkConfiguration} from 'aurelia-framework';
import {HelpModalService} from './help-modal-service';

export function configure(config: FrameworkConfiguration): void {
  config.container.registerSingleton('HelpModalService', HelpModalService);
}
