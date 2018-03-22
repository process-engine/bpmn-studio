import {Aurelia} from 'aurelia-framework';
import {CoreConfig} from './config/core-config';
import {ICoreConfiguration} from './contracts/core/ICoreConfig';
import environment from './environment';
import {TokenRepository} from './modules/token-repository/token.repository';

export function configure(aurelia: Aurelia): void {

  const tokenRepository: TokenRepository = new TokenRepository();
  aurelia.container.registerInstance('TokenRepository', tokenRepository);

  if (window.localStorage.getItem('baseRoute')) {
    environment.bpmnStudioClient.baseRoute = window.localStorage.getItem('baseRoute');
  }

  const coreConfig: ICoreConfiguration = new CoreConfig();

  aurelia.use
    .standardConfiguration()
    .feature('modules/dynamic-ui')
    .feature('modules/processengine')
    .feature('modules/authentication')
    .feature('modules/bpmn-studio_client', tokenRepository)
    .feature('resources')
    .plugin('aurelia-bootstrap')
    .plugin('aurelia-validation')
    .plugin('bpmn-studio_core_plugin', coreConfig);

  if (environment.debug) {
    aurelia.use.developmentLogging();
  }

  if (environment.testing) {
    aurelia.use.plugin('aurelia-testing');
  }

  aurelia.start().then(() => aurelia.setRoot());
}
