import {FrameworkConfiguration} from 'aurelia-framework';
import {DeployDiagramService} from './deploy-diagram.service';

export function configure(config: FrameworkConfiguration): void {
  config.container.registerSingleton('DeployDiagramService', DeployDiagramService);
}
