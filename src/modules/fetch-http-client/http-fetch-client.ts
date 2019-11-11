/* eslint-disable @typescript-eslint/generic-type-naming */
import * as EssentialProjectErrors from '@essential-projects/errors_ts';
import {IHttpClient, IRequestOptions, IResponse} from '@essential-projects/http_contracts';

export class HttpFetchClient implements IHttpClient {
  private httpSuccessResponseCode: number = 200;
  private httpRedirectResponseCode: number = 300;

  public async get<T>(url: string, options?: IRequestOptions): Promise<IResponse<T>> {
    const headers: any = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (options !== undefined && options.headers !== undefined) {
      const optionHeaders: Array<string> = Object.keys(options.headers);

      for (const header of optionHeaders) {
        headers[header] = options.headers[header];
      }
    }

    const request: Request = new Request(url, {
      method: 'GET',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: headers,
    });

    const response: Response = await fetch(request);

    const parsedResponse: IResponse<T> = await this.evaluateResponse<T>(response);

    return parsedResponse;
  }

  public async post<D, T>(url: string, data: D, options?: IRequestOptions): Promise<IResponse<T>> {
    const headers: any = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (options !== undefined && options.headers !== undefined) {
      const optionHeaders: Array<string> = Object.keys(options.headers);

      for (const header of optionHeaders) {
        headers[header] = options.headers[header];
      }
    }

    const request: Request = new Request(url, {
      method: 'POST',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: headers,
      body: JSON.stringify(data),
    });

    const response: Response = await fetch(request);

    const parsedResponse: IResponse<T> = await this.evaluateResponse<T>(response);

    return parsedResponse;
  }

  public async put<T>(url: string, data: T, options?: IRequestOptions): Promise<IResponse<T>> {
    const headers: any = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (options !== undefined && options.headers !== undefined) {
      const optionHeaders: Array<string> = Object.keys(options.headers);

      for (const header of optionHeaders) {
        headers[header] = options.headers[header];
      }
    }

    const request: Request = new Request(url, {
      method: 'PUT',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: headers,
      body: JSON.stringify(data),
    });

    const response: Response = await fetch(request);

    const parsedResponse: IResponse<T> = await this.evaluateResponse<T>(response);

    return parsedResponse;
  }

  public async delete<T>(url: string, options?: IRequestOptions): Promise<IResponse<T>> {
    const headers: any = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (options !== undefined && options.headers !== undefined) {
      const optionHeaders: Array<string> = Object.keys(options.headers);

      for (const header of optionHeaders) {
        headers[header] = options.headers[header];
      }
    }

    const request: Request = new Request(url, {
      method: 'DELETE',
      mode: 'cors',
      referrer: 'no-referrer',
      headers: headers,
    });

    const response: Response = await fetch(request);

    const parsedResponse: IResponse<T> = await this.evaluateResponse<T>(response);

    return parsedResponse;
  }

  private async evaluateResponse<T>(response: Response): Promise<IResponse<T>> {
    const responseBody: string = await response.text();

    const responseHasErrorCode: boolean = this.responseIsAnError(response.status);
    if (responseHasErrorCode) {
      const ErrorTypeToThrow: typeof Error = this.getErrorForStatusCode(response.status);

      throw new ErrorTypeToThrow(responseBody);
    }

    const parsedResponse: IResponse<T> = {
      result: this.parseResponseBody(responseBody),
      status: response.status,
    };

    return parsedResponse;
  }

  private responseIsAnError(responseStatus: number): boolean {
    return responseStatus < this.httpSuccessResponseCode || responseStatus >= this.httpRedirectResponseCode;
  }

  private getErrorForStatusCode(responseStatus: number): typeof Error {
    const errorName: string = EssentialProjectErrors.ErrorCodes[responseStatus];

    const isEssentialProjectsError: boolean = this.isEssentialProjectsError(errorName);
    if (isEssentialProjectsError) {
      return EssentialProjectErrors[errorName];
    }

    // return normal error, if there is no subtype for the given code.
    return Error;
  }

  private isEssentialProjectsError(errorName: string): boolean {
    return errorName in EssentialProjectErrors;
  }

  private parseResponseBody(result: any): any {
    // NOTE: For whatever reason, every response.body received by popsicle is a string,
    // even in a response header "Content-Type application/json" is set, or if the response body does not exist.
    // To get around this, we have to cast the result manually.
    try {
      return JSON.parse(result);
    } catch (error) {
      return result;
    }
  }
}
