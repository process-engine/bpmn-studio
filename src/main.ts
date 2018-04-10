import {ICoreConfiguration} from '@process-engine/bpmn-studio_core_contracts';
import {Aurelia} from 'aurelia-framework';
import {CoreConfig} from './config/core-config';
import environment from './environment';
import {TokenRepository} from './modules/token-repository/token.repository';

export function configure(aurelia: Aurelia): void {

  const tokenRepository: TokenRepository = new TokenRepository();
  aurelia.container.registerInstance('TokenRepository', tokenRepository);

  if ((<any> window).nodeRequire) {
    const ipcRenderer: any = (<any> window).nodeRequire('electron').ipcRenderer;
    const newHost: string = ipcRenderer.sendSync('get_host');
    localStorage.setItem('baseRoute', `http://${newHost}`);
  }

  if (window.localStorage.getItem('baseRoute')) {
    const baseRoute: string = window.localStorage.getItem('baseRoute');
    environment.bpmnStudioClient.baseRoute = baseRoute;
    environment.processengine.routes.processes = `${baseRoute}/datastore/ProcessDef`;
    environment.processengine.routes.iam = `${baseRoute}/iam`;
    environment.processengine.routes.messageBus = `${baseRoute}/mb`;
    environment.processengine.routes.processInstances = `${baseRoute}/datastore/Process`;
    environment.processengine.routes.startProcess = `${baseRoute}/processengine/start`;
    environment.processengine.routes.userTasks =  `${baseRoute}/datastore/UserTask`;
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
