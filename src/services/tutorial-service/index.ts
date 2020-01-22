import {FrameworkConfiguration} from 'aurelia-framework';
import {TutorialService} from './tutorial.service';

export function configure(config: FrameworkConfiguration): void {
  config.container.registerSingleton('TutorialService', TutorialService);
}
