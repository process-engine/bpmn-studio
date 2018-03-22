import {Router} from 'aurelia-router';
import {IPropertyPanelConfig} from './IPropertyPanelConfig';
import {IRoutes} from './Iroutes';

export interface ICoreConfiguration {
  routes: IRoutes;
  propertyPanelConfig: IPropertyPanelConfig;
  appRouter: Router;
}
