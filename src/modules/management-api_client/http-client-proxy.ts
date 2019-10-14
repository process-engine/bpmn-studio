import {IHttpClient, IRequestOptions, IResponse} from '@essential-projects/http_contracts';

export class HttpClientProxy implements IHttpClient {
  private proxiedHttpClient: IHttpClient;
  private urlPrefix: string;

  constructor(proxiedHttpClient: IHttpClient, urlPrefix: string) {
    this.proxiedHttpClient = proxiedHttpClient;
    this.urlPrefix = urlPrefix;
  }

  public setUrlPrefix(newUrlPrefix: string): void {
    this.urlPrefix = newUrlPrefix;
  }

  public get<TType>(url: string, options?: IRequestOptions): Promise<IResponse<TType>> {
    const prefixedUrl: string = `${this.urlPrefix}${url}`;

    return this.proxiedHttpClient.get(prefixedUrl, options);
  }

  public post<TValue, TType>(url: string, data: TValue, options?: IRequestOptions): Promise<IResponse<TType>> {
    const prefixedUrl: string = `${this.urlPrefix}${url}`;

    return this.proxiedHttpClient.post(prefixedUrl, data, options);
  }

  public put<TType>(url: string, data: TType, options?: IRequestOptions): Promise<IResponse<TType>> {
    const prefixedUrl: string = `${this.urlPrefix}${url}`;

    return this.proxiedHttpClient.put(prefixedUrl, data, options);
  }

  public delete<TType>(url: string, options?: IRequestOptions): Promise<IResponse<TType>> {
    const prefixedUrl: string = `${this.urlPrefix}${url}`;

    return this.proxiedHttpClient.delete(prefixedUrl, options);
  }
}
