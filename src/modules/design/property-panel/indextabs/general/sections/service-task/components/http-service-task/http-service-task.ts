import {EventAggregator} from 'aurelia-event-aggregator';
import {bindable, inject} from 'aurelia-framework';

import {IProperty, IServiceTaskElement} from '@process-engine/bpmn-elements_contracts';

import {IPageModel} from '../../../../../../../../../contracts';
import environment from '../../../../../../../../../environment';
import {ServiceTaskService} from '../service-task-service/service-task.service';

interface IAuthParameters {
  headers: {
    'Content-Type'?: string;
    Authorization?: string;
  };
}

@inject(EventAggregator)
export class HttpServiceTask {
  @bindable() public model: IPageModel;
  public businessObjInPanel: IServiceTaskElement;
  public selectedHttpMethod: string;
  public selectedHttpUrl: string;
  public selectedHttpBody: string;
  public selectedHttpAuth: string;
  public selectedHttpContentType: string;

  private eventAggregator: EventAggregator;
  private serviceTaskService: ServiceTaskService;

  constructor(eventAggregator?: EventAggregator) {
    this.eventAggregator = eventAggregator;
  }

  public modelChanged(): void {
    this.serviceTaskService = new ServiceTaskService(this.model);
    this.businessObjInPanel = this.model.elementInPanel.businessObject;

    this.initHttpServiceTask();
  }

  public selectedHttpParamsChanged(): void {
    const noHttpBodySelected: boolean = this.selectedHttpBody === undefined;

    if (noHttpBodySelected) {
      this.selectedHttpAuth = undefined;
      this.selectedHttpContentType = undefined;
    }

    const noHttpUrlSelected: boolean = this.selectedHttpUrl === undefined;

    if (noHttpUrlSelected) {
      this.selectedHttpBody = undefined;
      this.selectedHttpAuth = undefined;
      this.selectedHttpContentType = undefined;
    }

    this.serviceTaskService.getProperty('params').value = this.getParamsFromInput();
    this.publishDiagramChange();
  }

  public httpMethodChanged(): void {
    const property: IProperty = this.serviceTaskService.getProperty('method');
    property.value = this.selectedHttpMethod;

    this.getParamsFromInput();
    this.publishDiagramChange();
  }

  private initHttpServiceTask(): void {
    const methodPropertyExists: boolean = this.serviceTaskService.getProperty('method') !== undefined;
    const paramPropertyExists: boolean = this.serviceTaskService.getProperty('params') !== undefined;

    if (methodPropertyExists) {
      this.selectedHttpMethod = this.serviceTaskService.getProperty('method').value;
    } else {
      this.serviceTaskService.createProperty('method');
    }

    if (paramPropertyExists) {
      this.fillVariablesFromParam(this.serviceTaskService.getProperty('params').value);
    } else {
      this.serviceTaskService.createProperty('params');
    }
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }

  private getParamsFromInput(): string {
    const params = [];
    params.push(this.selectedHttpUrl);
    if (this.selectedHttpBody) {
      params.push(this.selectedHttpBody);
    }
    if (this.selectedHttpBody && (this.selectedHttpContentType || this.selectedHttpAuth)) {
      params.push({
        headers: {
          'Content-Type': this.selectedHttpContentType ? this.selectedHttpContentType : undefined,
          Authorization: this.selectedHttpAuth ? this.selectedHttpAuth : undefined,
        },
      });
    }

    let returnValue = `[${JSON.stringify(params[0])}`;

    if (params[1] != null) {
      if (params[1].startsWith('{') && params[1].endsWith('}')) {
        returnValue += `, ${params[1]}`;
      } else {
        returnValue += `, ${JSON.stringify(params[1])}`;
      }
    }

    if (params[2] != null) {
      returnValue += `, ${JSON.stringify(params[2])}`;
    }

    returnValue += ']';

    return returnValue;
  }

  private fillVariablesFromParam(params: string): void {
    let parsedParams = {};
    try {
      parsedParams = JSON.parse(params);
      this.selectedHttpUrl = parsedParams[0];
      this.selectedHttpBody =
        typeof parsedParams[1] === 'object' ? JSON.stringify(parsedParams[1], null, 2) : parsedParams[1];
      this.selectedHttpContentType = parsedParams[2]?.headers['Content-Type'];
      this.selectedHttpAuth = parsedParams[2]?.headers.Authorization;
    } catch {
      const stringParams = params.trim();

      const indexOfFirstComma = stringParams.indexOf(',');
      const url = stringParams
        .substring(0, indexOfFirstComma)
        .replace(/"/g, '')
        .replace('[', '');
      this.selectedHttpUrl = url;

      const indexOfFirstOpenBraket = stringParams.indexOf('{');
      let body = stringParams.substr(indexOfFirstOpenBraket);
      const indexOfClosingBraket = body.lastIndexOf('},') === -1 ? body.lastIndexOf(']') : body.lastIndexOf('},');
      if (indexOfClosingBraket === -1) {
        return;
      }

      body = body.substring(0, indexOfClosingBraket + 1);

      if (body.endsWith(']')) {
        body = body.replace(']', '');
      }
      this.selectedHttpBody = body;

      let headers = stringParams.replace(url, '').replace(body, '');
      const startIndexOfHeaders = headers.indexOf('{');
      const endIndexOfHeader = headers.lastIndexOf('}');

      if (startIndexOfHeaders === -1 || endIndexOfHeader === -1) {
        return;
      }

      headers = headers.substr(startIndexOfHeaders, endIndexOfHeader).replace(']', '');
      const headersObject = JSON.parse(headers);

      this.selectedHttpContentType = headersObject.headers['Content-Type'];
      this.selectedHttpAuth = headersObject.headers.Authorization;
    }
  }
}
