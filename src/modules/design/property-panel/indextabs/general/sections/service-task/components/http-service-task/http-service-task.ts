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

type HttpServiceTaskParams = {
  url: string;
  body: string;
  contentType: string;
  authorization: string;
};

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

    this.serviceTaskService.updateOrCreateProperty('params', this.getParamsFromInput());
    this.serviceTaskService.updateOrCreateProperty('studio.paramUrl', this.selectedHttpUrl);
    this.serviceTaskService.updateOrCreateProperty('studio.paramBody', this.selectedHttpBody);
    this.serviceTaskService.updateOrCreateProperty('studio.paramContentType', this.selectedHttpContentType);
    this.serviceTaskService.updateOrCreateProperty('studio.paramAuthorization', this.selectedHttpAuth);
    this.publishDiagramChange();
  }

  public httpMethodChanged(): void {
    const property: IProperty = this.serviceTaskService.getProperty('method');
    property.value = this.selectedHttpMethod;

    this.serviceTaskService.updateOrCreateProperty('params', this.getParamsFromInput());
    this.publishDiagramChange();
  }

  private initHttpServiceTask(): void {
    const methodPropertyExists: boolean = this.serviceTaskService.getProperty('method') !== undefined;

    if (methodPropertyExists) {
      this.selectedHttpMethod = this.serviceTaskService.getProperty('method').value;
    } else {
      this.serviceTaskService.createProperty('method');
    }

    let params = this.getParamProperties();
    if (params == null) {
      params = this.unreliableGetPropertiesFromParams();
    }

    const paramsExist = params != null;
    if (paramsExist) {
      this.selectedHttpUrl = params.url;
      this.selectedHttpBody = params.body;
      this.selectedHttpContentType = params.contentType;
      this.selectedHttpAuth = params.authorization;
    }
  }

  private publishDiagramChange(): void {
    this.eventAggregator.publish(environment.events.diagramChange);
  }

  private getParamsFromInput(): string {
    const params = [];
    params.push(this.selectedHttpUrl);
    if (this.selectedHttpMethod !== 'get' && this.selectedHttpMethod !== 'delete') {
      if (this.selectedHttpBody) {
        params.push(this.selectedHttpBody);
      } else if (this.selectedHttpMethod === 'post' || this.selectedHttpMethod === 'put') {
        params.push({});
      }
    }
    if (this.selectedHttpContentType || this.selectedHttpAuth) {
      params.push({
        headers: {
          'Content-Type': this.selectedHttpContentType ? this.selectedHttpContentType : undefined,
          Authorization: this.selectedHttpAuth ? this.selectedHttpAuth : undefined,
        },
      });
    }

    let returnValue = `[${JSON.stringify(params[0])}`;

    if (params[1] != null) {
      if (params[1].toString().startsWith('{') && params[1].toString().endsWith('}')) {
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

  private getParamProperties(): HttpServiceTaskParams | null {
    const paramUrl = this.serviceTaskService.getProperty('studio.paramUrl')?.value;
    const paramBody = this.serviceTaskService.getProperty('studio.paramBody')?.value;
    const paramContentType = this.serviceTaskService.getProperty('studio.paramContentType')?.value;
    const paramAuthorization = this.serviceTaskService.getProperty('studio.paramAuthorization')?.value;

    if (paramUrl == null && paramBody == null && paramContentType == null && paramAuthorization == null) {
      return null;
    }

    return {
      url: paramUrl,
      body: paramBody,
      contentType: paramContentType,
      authorization: paramAuthorization,
    };
  }

  private unreliableGetPropertiesFromParams(): HttpServiceTaskParams | null {
    const params = this.serviceTaskService.getProperty('params')?.value;

    if (params == null) {
      return null;
    }

    let url;
    let body;
    let contentType;
    let authorization;

    let stringParams: string = params?.trim() || '';

    const hasHeaders = stringParams.includes('{"headers');
    let headers = '';
    if (hasHeaders) {
      const indexOfHeaders = stringParams.indexOf('{"headers"');
      headers = stringParams.substring(indexOfHeaders).replace(/]$/g, '');
      try {
        const parsedHeaders = JSON.parse(headers);
        contentType = parsedHeaders.headers['Content-Type'];
        authorization = parsedHeaders.headers.Authorization;
      } catch {
        // do nothing
      }
      stringParams = stringParams.substring(0, indexOfHeaders);
    }

    const hasBody = stringParams.includes(',');
    let newBody = '';
    if (hasBody) {
      const indexOfComma = stringParams.indexOf(',');
      newBody = stringParams
        .substring(indexOfComma)
        .trim()
        .replace(/,$/g, '');
      newBody = newBody.replace(/^,/, '').trim();

      const isPossibleObject = newBody.startsWith('{') && newBody.endsWith('}');
      if (!isPossibleObject) {
        newBody = newBody.replace(/]$/g, '').replace(/^"|"$/g, '');
      }

      body = newBody;
      stringParams = stringParams.substring(0, indexOfComma);
    }

    const noCommaInStringParams = !stringParams.includes(',');
    if (noCommaInStringParams) {
      url = stringParams
        .replace('[', '')
        .replace(/]$/g, '')
        .replace(/"/g, '')
        .trim();
    }

    if (url == null && body == null && contentType == null && authorization == null) {
      return null;
    }

    return {
      url: url,
      body: body,
      contentType: contentType,
      authorization: authorization,
    };
  }
}
