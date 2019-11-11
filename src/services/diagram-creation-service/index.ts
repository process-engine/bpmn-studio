import {FrameworkConfiguration} from 'aurelia-framework';
import {DiagramCreationService} from './diagram-creation.service';

export async function configure(config: FrameworkConfiguration): Promise<void> {
  config.container.registerSingleton('DiagramCreationService', DiagramCreationService);
}
