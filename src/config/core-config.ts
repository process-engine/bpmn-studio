import {ICoreConfiguration, IPropertyPanelConfig, IRoutes} from '@process-engine/bpmn-studio_core_contracts';
import {inject} from 'aurelia-framework';
import {Router} from 'aurelia-router';

@inject(Router)
export class CoreConfig implements ICoreConfiguration {
  public routes: IRoutes = {
    processes: `http://localhost:8000/datastore/ProcessDef`,
    startProcess: `http://localhost:8000/processengine/start`,
    processInstances: `http://localhost:8000/datastore/Process`,
    messageBus: `http://localhost:8000/mb`,
    iam: `http://localhost:8000/iam`,
    userTasks: `http://localhost:8000/datastore/UserTask`,
  };
  public propertyPanelConfig: IPropertyPanelConfig = {
    minWidth: 190,
    maxWidth: 150,
  };
  public appRouter: Router;
}
