import {FrameworkConfiguration} from 'aurelia-framework';
import {SaveDiagramService} from './save-diagram.service';

export function configure(config: FrameworkConfiguration): void {
  config.container.registerSingleton('SaveDiagramService', SaveDiagramService);
}
