import {EventAggregator} from 'aurelia-event-aggregator';
import {FrameworkConfiguration} from 'aurelia-framework';

import {IHttpClient} from '@essential-projects/http_contracts';
import {ExternalAccessor, ManagementApiClient} from '@process-engine/management_api_client';
import {IManagementApiClient} from '@process-engine/management_api_contracts';

import {ISolutionEntry} from '../../contracts';
import environment from '../../environment';
import {HttpClientProxy} from './http-client-proxy';

export async function configure(config: FrameworkConfiguration): Promise<void> {
  const httpClient: IHttpClient = config.container.get('HttpFetchClient');

  const configuredBaseRoute: string = window.localStorage.getItem('InternalProcessEngineRoute');

  const urlPrefix: string = `${configuredBaseRoute}/`;
  const proxiedHttpClient: HttpClientProxy = new HttpClientProxy(httpClient, urlPrefix);

  const externalAccessor: ExternalAccessor = createExternalAccessor(proxiedHttpClient, configuredBaseRoute);
  const clientService: IManagementApiClient = createManagementApiClient(externalAccessor);

  let socketIsAlreadyInitialized: boolean = false;

  // register event to change process engine route
  const eventAggregator: EventAggregator = config.container.get(EventAggregator);
  eventAggregator.subscribe(environment.events.configPanel.solutionEntryChanged, (newSolutionEntry: ISolutionEntry) => {
    proxiedHttpClient.setUrlPrefix(`${newSolutionEntry.uri}/`);

    externalAccessor.config = {
      socketUrl: newSolutionEntry.uri,
    };

    if (socketIsAlreadyInitialized) {
      externalAccessor.disconnectSocket(newSolutionEntry.identity);
      externalAccessor.initializeSocket(newSolutionEntry.identity);
    } else {
      socketIsAlreadyInitialized = true;
    }
  });

  config.container.registerInstance('ManagementApiClientService', clientService);
}

function createExternalAccessor(httpClient: IHttpClient, socketUrl: string): ExternalAccessor {
  const externalAccessor: ExternalAccessor = new ExternalAccessor(httpClient);

  externalAccessor.config = {
    socketUrl: socketUrl,
  };

  return externalAccessor;
}

function createManagementApiClient(externalAccessor: ExternalAccessor): IManagementApiClient {
  return new ManagementApiClient(externalAccessor);
}
