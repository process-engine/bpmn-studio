import {inject} from 'aurelia-framework';

import * as bundle from '@process-engine/bpmn-js-custom-bundle';
import {
  Correlation,
  IManagementApiService,
  ManagementContext,
  ProcessModelExecution,
} from '@process-engine/management_api_contracts';

import {ProcessModel} from '@process-engine/consumer_api_contracts';
import {IAuthenticationService, IBpmnModeler, NotificationType} from '../../contracts/index';
import {NotificationService} from '../notification/notification.service';
import {IInspectCorrelationService} from './contracts';

interface RouteParameters {
  processModelId: string;
}

@inject('InspectCorrelationService', 'NotificationService', 'ManagementApiClientService', 'AuthenticationService')
export class InspectCorrelation {
  public processModelCorrelations: Array<Correlation>;
  public correlationSelected: boolean;
  public canvasModel: HTMLElement;
  public currentToken: string;
  public currentLog: string;
  public showToken: boolean;
  public showLog: boolean;
  public showDiagram: boolean;

  private _inspectCorrelationService: IInspectCorrelationService;
  private _notificationService: NotificationService;
  private _managementApiService: IManagementApiService;
  private _authenticationService: IAuthenticationService;
  private _diagramViewer: IBpmnModeler;

  constructor(inspectCorrelationService: IInspectCorrelationService,
              notificationService: NotificationService,
              managementApiService: IManagementApiService,
              authenticationService: IAuthenticationService) {

    this._inspectCorrelationService = inspectCorrelationService;
    this._notificationService = notificationService;
    this._managementApiService = managementApiService;
    this._authenticationService = authenticationService;
  }

  public async activate(routeParameters: RouteParameters): Promise<void> {
    const processModelId: string = routeParameters.processModelId;

    this.processModelCorrelations = await this._inspectCorrelationService.getAllCorrelationsForProcessModelId(processModelId);
  }

  public attached(): void {
    this._diagramViewer = new bundle.viewer({
      additionalModules:
      [
        bundle.ZoomScrollModule,
        bundle.MoveCanvasModule,
      ],
    });

    this._diagramViewer.attachTo(this.canvasModel);
  }

  public detached(): void {
    this.correlationSelected = false;
  }

  public async selectCorrelation(processModelId: string): Promise<void> {
    const managementContext: ManagementContext = this._getManagementContext();

    this.correlationSelected = true;

    const processModel: ProcessModelExecution.ProcessModel = await this._managementApiService.getProcessModelById(managementContext, processModelId);
    const xml: string = processModel.xml;

    this._importXml(xml);
    const lorem: string = `Lorem ipsum dolor sit amet, consetetur sadipscing
    elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna
    aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo
    dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus
    est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur
    sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et
    dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam
    et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea
    takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit
    amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt
    ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et
    accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea
    takimata sanctus est Lorem ipsum dolor sit amet. Duis autem vel eum iriure
    dolor in hendrerit in vulputate velit esse molestie consequat, vel illum
    dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio
    dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te
    feugait nulla facilisi. Lorem ipsum dolor sit amet,`;

    this.currentToken = `Token: ${lorem}`;
    this.currentLog = `Log ${lorem}`;
  }

  public toggleTokenVisibility(): void {
    this.showToken = !this.showToken;
  }

  public toggleLogVisibility(): void {
    this.showLog = !this.showLog;
  }

  public toggleDiagramVisibility(): void {
    this.showDiagram = !this.showDiagram;
  }

  private async _importXml(xml: string): Promise <void> {
    const xmlIsNotLoaded: boolean = (xml === undefined || xml === null);

    if (xmlIsNotLoaded) {
      const notificationMessage: string = 'The xml could not be loaded. Please try to reopen the Diff View or reload the Detail View.';
      this._notificationService.showNotification(NotificationType.ERROR, notificationMessage);

      return;
    }

    const xmlImportPromise: Promise<void> = new Promise((resolve: Function, reject: Function): void => {
      this._diagramViewer.importXML(xml, (importXmlError: Error) => {
        if (importXmlError) {
          reject(importXmlError);

          return;
        }

        resolve();
      });
    });

    return xmlImportPromise;
  }

  private _getManagementContext(): ManagementContext {
    const accessToken: string = this._authenticationService.getAccessToken();
    const context: ManagementContext = {
      identity: accessToken,
    };

    return context;
  }
}
