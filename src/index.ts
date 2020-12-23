/// <reference lib="dom" />
import { stringify as stringifyQuery } from 'query-string';
import type { Json, JsonObject } from '@lcdev/ts';
import 'isomorphic-form-data';

let globalFetch: typeof fetch;

export function setGlobalFetch(myFetch: typeof fetch) {
  globalFetch = myFetch;
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
}

export interface Query {
  [key: string]: string | number | boolean | undefined | null;
}

export interface SerializationOptions {
  stripEmptyStrings?: boolean;
}

export interface BearerToken {
  token?: string;
}

export type OnResponse = (r: Response) => void | Promise<void>;
export type OnJsonResponse = (data: Json, r: Response) => void | Promise<void>;

export interface ApiCall<Method extends HttpMethod> extends Promise<Response> {
  readonly path: string;
  readonly method: Method;
  readonly query?: Query;
  readonly bearerToken?: BearerToken;
  readonly contentType?: string;
  readonly headers?: Headers;
  readonly body?: Json | BodyInit;

  withQuery(query: Query, options?: SerializationOptions): ApiCall<Method>;

  withHeaders(headers: Headers): ApiCall<Method>;
  withHeader(name: string, value: string): ApiCall<Method>;
  withContentType(contentType: string): ApiCall<Method>;
  withBearerToken(token: BearerToken): ApiCall<Method>;

  withBody<B extends Json | BodyInit>(
    body: B,
    json?: boolean,
    options?: SerializationOptions,
  ): ApiCall<Method>;

  withJsonBody<B extends Json>(body: B, options?: SerializationOptions): ApiCall<Method>;
  withFormDataBody<B extends Query>(data: B, options?: SerializationOptions): ApiCall<Method>;
  withURLEncodedBody<B extends Query>(data: B, options?: SerializationOptions): ApiCall<Method>;

  expectStatus(code: number): ApiCall<Method>;
  expectSuccessStatus(): ApiCall<Method>;

  onResponse(cb: OnResponse): ApiCall<Method>;
  onJsonResponse(cb: OnJsonResponse): ApiCall<Method>;

  build(): { path: string } & RequestInit;
  json<D extends Json = Json>(): Promise<D>;
  jsonAndResponse<D extends Json = Json>(): Promise<[D, Response]>;
  blob(): Promise<Blob>;
  blobAndResponse(): Promise<[Blob, Response]>;
  text(): Promise<string>;
  textAndResponse(): Promise<[string, Response]>;
}

export type ApiCallTransform<M extends HttpMethod> =
  | [M, (call: ApiCall<M>) => ApiCall<M>]
  | ((call: ApiCall<M>) => ApiCall<M>);

export interface Api {
  call<M extends HttpMethod>(path: string, method: M): ApiCall<M>;
  get(path: string): ApiCall<HttpMethod.GET>;
  post(path: string): ApiCall<HttpMethod.POST>;
  put(path: string): ApiCall<HttpMethod.PUT>;
  patch(path: string): ApiCall<HttpMethod.PATCH>;
  delete(path: string): ApiCall<HttpMethod.DELETE>;
  head(path: string): ApiCall<HttpMethod.HEAD>;
  options(path: string): ApiCall<HttpMethod.OPTIONS>;

  withTransform<M extends HttpMethod>(t: ApiCallTransform<M>): Api;
  withBearerToken(token: BearerToken): Api;
  withBaseURL(path: string): Api;

  onResponse(cb: OnResponse): Api;
  onJsonResponse(cb: OnJsonResponse): Api;

  changeBaseURL(path: string): void;
}

export const buildPath = (...args: string[]) => {
  // https://stackoverflow.com/a/46427607/1165996
  return args
    .map((part, i) => {
      if (i === 0) {
        return part.trim().replace(/[/]*$/g, '');
      }

      return part.trim().replace(/(^[/]*|[/]*$)/g, '');
    })
    .filter((x) => x.length)
    .join('/');
};

export const api = (baseURL: string, transforms: ApiCallTransform<any>[] = []): Api => {
  const call = <M extends HttpMethod>(path: string, method: M) => {
    return new ApiCallImpl<M>(buildPath(baseURL, path), method).applyTransforms(transforms);
  };

  const withTransform = <M extends HttpMethod>(t: ApiCallTransform<M>) => {
    return api(baseURL, transforms.concat([t]));
  };

  const withBearerToken = (token: BearerToken) => {
    return withTransform((c) => c.withBearerToken(token));
  };

  const withBaseURL = (path: string) => {
    return api(buildPath(baseURL, path), transforms);
  };

  const onResponse = (cb: OnResponse) => {
    return withTransform((c) => c.onResponse(cb));
  };

  const onJsonResponse = (cb: OnJsonResponse) => {
    return withTransform((c) => c.onJsonResponse(cb));
  };

  return {
    call,
    withTransform,
    withBearerToken,
    withBaseURL,
    onResponse,
    onJsonResponse,
    get: (path) => call<HttpMethod.GET>(path, HttpMethod.GET),
    post: (path) => call(path, HttpMethod.POST),
    put: (path) => call(path, HttpMethod.PUT),
    patch: (path) => call(path, HttpMethod.PATCH),
    delete: (path) => call(path, HttpMethod.DELETE),
    head: (path) => call(path, HttpMethod.HEAD),
    options: (path) => call(path, HttpMethod.OPTIONS),
    changeBaseURL: (path) => {
      baseURL = path;
    },
  };
};

export const apiCall = <M extends HttpMethod>(path: string, method: M): ApiCall<M> => {
  return new ApiCallImpl(path, method);
};

export const get = (path: string): ApiCall<HttpMethod.GET> => apiCall(path, HttpMethod.GET);
export const post = (path: string): ApiCall<HttpMethod.POST> => apiCall(path, HttpMethod.POST);
export const put = (path: string): ApiCall<HttpMethod.PUT> => apiCall(path, HttpMethod.PUT);
export const patch = (path: string): ApiCall<HttpMethod.PATCH> => apiCall(path, HttpMethod.PATCH);
export const remove = (path: string): ApiCall<HttpMethod.DELETE> =>
  apiCall(path, HttpMethod.DELETE);

function applySerializationOptions<O extends Json>(
  obj: O,
  options: SerializationOptions = {},
): Json {
  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((v) => applySerializationOptions(v, options));
  }

  const output = { ...(obj as JsonObject) };

  if (options?.stripEmptyStrings) {
    for (const [key, val] of Object.entries(output)) {
      if (val === '') {
        delete output[key];
      }
    }
  }

  return output;
}

class ApiCallImpl<Method extends HttpMethod> implements ApiCall<Method> {
  private consumed = false;
  private queryOptions?: SerializationOptions;
  private bodyOptions?: SerializationOptions;
  private onResponseCbs: OnResponse[] = [];
  private onJsonResponseCbs: OnJsonResponse[] = [];

  constructor(
    public readonly path: string,
    public readonly method: Method,
    public query?: Query,
    public bearerToken?: BearerToken,
    public contentType?: string,
    public headers?: Headers,
    public body?: Json | BodyInit,
  ) {}

  applyTransforms(transforms: ApiCallTransform<HttpMethod>[]) {
    return transforms.reduce<ApiCall<Method>>((call, transform) => {
      if (Array.isArray(transform)) {
        const [method, wrap] = transform;

        if (method === this.method) {
          return wrap(call) as ApiCall<Method>;
        }

        return call;
      }

      return transform(call) as ApiCall<Method>;
    }, this);
  }

  withQuery(query: Query, options?: SerializationOptions) {
    this.query = query;
    this.queryOptions = options;
    return this;
  }

  withBearerToken(token: BearerToken) {
    this.bearerToken = token;
    return this;
  }

  withContentType(contentType: string) {
    this.contentType = contentType;
    return this;
  }

  withHeaders(headers: Headers) {
    this.headers = headers;
    return this;
  }

  withHeader(name: string, value: string) {
    if (!this.headers) this.headers = new Headers();
    this.headers.set(name, value);
    return this;
  }

  withBody<B extends Json | BodyInit>(body: B, json = true, options?: SerializationOptions) {
    this.body = body;
    this.bodyOptions = options;
    if (json) return this.withContentType('application/json');
    return this;
  }

  withJsonBody<B extends Json>(body: B, options?: SerializationOptions) {
    return this.withBody(body, true, options);
  }

  withFormDataBody<B extends Query>(data: B, options?: SerializationOptions) {
    const body = new FormData();

    for (const [k, v] of Object.entries(data)) {
      if (v) body.append(k, v.toString());
    }

    return this.withBody(body, false, options);
  }

  withURLEncodedBody<B extends Query>(data: B, options?: SerializationOptions) {
    const body = new URLSearchParams();

    for (const [k, v] of Object.entries(data)) {
      if (v) body.append(k, v.toString());
    }

    return this.withContentType('application/x-www-form-urlencoded').withBody(body, false, options);
  }

  expectStatus(code: number) {
    return this.onResponse((res) => {
      if (res.status !== code) {
        throw Object.assign(new Error(`Expected ${code} response, got ${res.status}`), {
          response: res,
        });
      }
    });
  }

  expectSuccessStatus() {
    return this.onResponse((res) => {
      if (res.status < 200 || res.status >= 300) {
        throw Object.assign(new Error(`Expected a successful response, got ${res.status}`), {
          response: res,
        });
      }
    });
  }

  onResponse(cb: OnResponse) {
    this.onResponseCbs.push(cb);
    return this;
  }

  onJsonResponse(cb: OnJsonResponse) {
    this.onJsonResponseCbs.push(cb);
    return this;
  }

  build() {
    const headers = this.headers ?? new Headers();

    if (this.bearerToken?.token) {
      headers.set('authorization', `Bearer ${this.bearerToken.token}`);
    }

    if (this.contentType) {
      headers.set('content-type', this.contentType);
    }

    let path: string;

    if (this.query) {
      path = `${this.path}?${stringifyQuery(
        applySerializationOptions(this.query, this.queryOptions) as JsonObject,
      )}`;
    } else {
      path = this.path;
    }

    let body: BodyInit | undefined;

    if (this.body && this.contentType === 'application/json') {
      body = JSON.stringify(applySerializationOptions(this.body as JsonObject, this.bodyOptions));
    } else {
      body = this.body as BodyInit | undefined;
    }

    return {
      path,
      headers,
      method: this.method,
      body,
    };
  }

  then: Promise<Response>['then'] = (onfulfilled, onrejected) => {
    if (this.consumed) {
      return Promise.reject(
        new Error('Called ApiCall twice! Re-use the promise instead of making multiple requests.'),
      );
    }

    this.consumed = true;

    const { path, ...options } = this.build();

    const localFetch = globalFetch ?? fetch;

    return localFetch(path, options).then((response) => {
      return this.onResponseCbs
        .reduce((acc, cb) => acc.then(() => cb(response)), Promise.resolve())
        .then(() => response)
        .then(onfulfilled, onrejected);
    });
  };

  catch: Promise<Response>['catch'] = async (onrejected) => {
    return this.then().catch(onrejected);
  };

  finally: Promise<Response>['finally'] = async (onfinally) => {
    return this.then().finally(onfinally);
  };

  get [Symbol.toStringTag]() {
    return 'ApiCall';
  }

  async json<D extends Json>() {
    return this.jsonAndResponse<D>().then(([json]) => json);
  }

  async jsonAndResponse<D extends Json>() {
    return this.then().then(async (res) => {
      const json = (await res.json()) as D;

      for (const cb of this.onJsonResponseCbs) await cb(json, res);

      return [json, res] as [D, Response];
    });
  }

  async blob() {
    return this.blobAndResponse().then(([blob]) => blob);
  }

  async blobAndResponse() {
    return this.then().then(async (res) => [await res.blob(), res] as [Blob, Response]);
  }

  async text() {
    return this.textAndResponse().then(([text]) => text);
  }

  async textAndResponse() {
    return this.then().then(async (res) => [await res.text(), res] as [string, Response]);
  }
}
