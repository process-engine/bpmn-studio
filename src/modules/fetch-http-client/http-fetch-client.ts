import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IHttpClient, IRequestOptions, IResponse} from '@essential-projects/http_contracts';

interface IErrorInfo {
  message: string;
  additionalInformation?: object;
}

export class HttpFetchClient implements IHttpClient {
  private httpSuccessResponseCode = 200;
  private httpRedirectResponseCode = 300;

  public async get<TResponse>(url: string, options?: IRequestOptions): Promise<IResponse<TResponse>> {

    const headers = this.buildHeaders(options);

    const request = new Request(url, {
      method: 'GET',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: headers,
    });

    const response = await fetch(request);

    const parsedResponse = await this.evaluateResponse<TResponse>(response);

    return parsedResponse;
  }

  public async post<TPayload, TResult>(url: string, data: TPayload, options?: IRequestOptions): Promise<IResponse<TResult>> {

    const headers = this.buildHeaders(options);

    const request = new Request(url, {
      method: 'POST',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: headers,
      body: JSON.stringify(data),
    });

    const response = await fetch(request);

    const parsedResponse = await this.evaluateResponse<TResult>(response);

    return parsedResponse;
  }

  public async put<TResult>(url: string, data: TResult, options?: IRequestOptions): Promise<IResponse<TResult>> {

    const headers = this.buildHeaders(options);

    const request = new Request(url, {
      method: 'PUT',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: headers,
      body: JSON.stringify(data),
    });

    const response = await fetch(request);

    const parsedResponse = await this.evaluateResponse<TResult>(response);

    return parsedResponse;
  }

  public async delete<TResult>(url: string, options?: IRequestOptions): Promise<IResponse<TResult>> {

    const headers = this.buildHeaders(options);

    const request = new Request(url, {
      method: 'DELETE',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: headers,
    });

    const response = await fetch(request);

    const parsedResponse = await this.evaluateResponse<TResult>(response);

    return parsedResponse;
  }

  private buildHeaders(options?: IRequestOptions): HeadersInit {

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (options?.headers != undefined) {
      const optionHeaders = Object.keys(options.headers);

      for (const header of optionHeaders) {
        headers[header] = options.headers[header];
      }
    }

    return headers;
  }

  private async evaluateResponse<TPayload>(response: Response): Promise<IResponse<TPayload>> {

    const body = await response.text();

    if (this.responseIsAnError(response)) {
      this.createAndThrowError(response.status, body);
    }

    const parsedResponse: IResponse<TPayload> = {
      result: this.tryParseStringtoJson(body),
      status: response.status,
    };

    return parsedResponse;
  }

  private responseIsAnError(response: Response): boolean {
    return response.status < this.httpSuccessResponseCode || response.status >= this.httpRedirectResponseCode;
  }

  private createAndThrowError(statusCode: number, body: string): void {
    const errorName = EssentialProjectErrors.ErrorCodes[statusCode];

    const errorInfo = this.tryParseStringtoJson<IErrorInfo | string>(body);

    if (typeof errorInfo === 'string') {
      this.throwErrorFromString(errorName, errorInfo as string);
    }

    this.throwErrorFromObject(errorName, errorInfo as IErrorInfo);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tryParseStringtoJson<TResult>(result: any): TResult {
    try {
      return JSON.parse(result);
    } catch (error) {
      return result;
    }
  }

  private throwErrorFromString(errorName: string, message: string): void {
    throw this.isEssentialProjectsError(errorName)
      ? new EssentialProjectErrors[errorName](message)
      : new EssentialProjectErrors.InternalServerError(message);
  }

  private throwErrorFromObject(errorName: string, errorInfo: IErrorInfo): void {

    if (this.isEssentialProjectsError(errorName)) {
      this.throwEssentialProjectsError(errorName, errorInfo as IErrorInfo);
    }

    this.throwNonEssentialProjectsError(errorInfo as IErrorInfo);
  }

  private throwEssentialProjectsError(errorName: string, errorInfo: IErrorInfo): void {
    const essentialProjectsError = new EssentialProjectErrors[errorName](errorInfo.message);
    essentialProjectsError.additionalInformation = errorInfo.additionalInformation;

    throw essentialProjectsError;
  }

  private throwNonEssentialProjectsError(error: IErrorInfo): void {
    throw new Error(error.message);
  }

  private isEssentialProjectsError(errorName: string): boolean {
    return errorName in EssentialProjectErrors;
  }
}
