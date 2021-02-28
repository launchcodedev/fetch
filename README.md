# Fetch
Tiny wrapper around DOM fetch for common API wrappings. Isomorphic (supports browsers and Node.js), if `fetch` is available or polyfilled.

[![Licensed under MPL 2.0](https://img.shields.io/badge/license-MPL_2.0-green.svg)](https://www.mozilla.org/en-US/MPL/2.0/)
[![Build Status](https://github.com/launchcodedev/fetch/workflows/CI/badge.svg)](https://github.com/launchcodedev/fetch/actions)
[![npm](https://img.shields.io/npm/v/@lcdev/fetch.svg)](https://www.npmjs.com/package/@lcdev/fetch)
[![BundlePhobia](https://badgen.net/bundlephobia/minzip/@lcdev/fetch)](https://bundlephobia.com/result?p=@lcdev/fetch@latest)

```bash
yarn add @lcdev/fetch@VERSION
```

Features:
- Easy to use builder-style API
- Quick JSON, blob and text parsing options
- Shareable builders for common options (authorization headers, onResponse hooks, etc.)
- No magic - call `build()` and pass to fetch if you want
- TypeScript friendly
- Tiny footprint (2kb)

If you are looking for something not available here, try [ky-universal](https://github.com/sindresorhus/ky-universal) or [axios](https://github.com/axios/axios).

There are two main functions exported by this package:

1. The `apiCall` function, which is used for creating a one-off fetch request
2. The `api` function, which creates a shared builder for many fetch requests

### `apiCall`
The simplest function is `apiCall`, which sets up a fetch request.

```typescript
import { HttpMethod, apiCall } from '@lcdev/fetch';

await apiCall('https://base-url.com/endpoint', HttpMethod.GET).json<TheResponseObject>();
```

This can be shortened by using the http method aliases exported by this package.

```typescript
import { get } from '@lcdev/fetch';

await get('https://base-url.com/endpoint').json<TheResponseObject>();
```

There are `get`, `post`, `put`, `patch`, and `remove` aliases.

With a `ApiCall` builder (the object returned by `apiCall`), we can chain many options for the request.

- `withQuery(object, options?: SerializationOptions)`: adds query parameters, stringifying the object with `query-string`
- `withHeaders(Headers)`: adds headers to request
- `withHeader(key, value)`: adds a single header to the request
- `withContentType(string)`: changes the content-type header
- `withBearerToken(object: { token?: string })`: adds `Authorization: Bearer {token}` header
- `withBody(object, isJson?: boolean, options?: SerializationOptions)`: adds a request body
- `withJsonBody(object, options?: SerializationOptions)`: adds JSON request body
- `withFormDataBody(FormData, options?: SerializationOptions)`: adds form-data request body
- `withURLEncodedBody(object, options?: SerializationOptions)`: adds 'application/x-www-form-urlencoded' request body
- `withExtraOptions(options: ExtraOptions)`: escape hatch to add extra options to `fetch` while still using the builder pattern
- `expectStatus(number)`: throw an error if the response status isn't the expected one
- `expectSuccessStatus()`: throw an error if the response status isn't in 200 range
- `onResponse(callback)`: calls your function whenever responses are received
- `onJsonResponse(callback)`: calls your function whenever JSON responses are received
- `build()`: constructs options that can be passed into `fetch` directly
- `json<T>()`: calls fetch and parses response as JSON
- `jsonAndResponse<T>()`: calls fetch and parses response as JSON, along with the full Response object
- `blob<T>()`: calls fetch and parses response as a blob
- `blobAndResponse<T>()`: calls fetch and parses response as a blob, along with the full Response object
- `text<T>()`: calls fetch and parses response as text
- `textAndResponse<T>()`: calls fetch and parses response as text, along with the full Response object

Because we expose `build`, there is always an escape hatch if you need something non-standard.

Note that fetch calls are **lazy** - meaning that nothing will run until you call `.then` or `await` it.

### `api`
Most of the time, we make web apps that call APIs many times in different ways (endpoints, authorization, etc.).
This package provides a way to share configuration easily between all calls, without being "global".

```typescript
import { api } from '@lcdev/fetch';

const myBackend = api('https://base-url.com')
  .withBearerToken({ token: '...' })
  .onResponse((res) => {
    if (res.status === 401) logout();
  });

// we can re-use myBackend where we want to
// you might put myBackend in a React Context, or inject it into state management
await myBackend.get('/endpoint').json<TheResponseObject>();
await myBackend.post('/endpoint').withJsonBody({ foo: 'bar' }).json<TheOtherResponse>();
```

Here, `myBackend` is an `Api` object, which exposes ways to create `ApiCall`s (like above).
You can perform the same builder functions on these as with `apiCall`.

You can add little callbacks to `myBackend` using `onResponse` or `onJsonResponse`. You might
do this for logging, for business logic, etc.

You can change the base URL if required with `changeBaseURL(path)`, though be warned that 
every request from then on will then be based on that.

## NodeJS Support
Just polyfill `fetch`, and this package will work. Install `cross-fetch` package and add the following to your main file.

```bash
yarn add cross-fetch@3
```

```typescript
import fetch from 'cross-fetch';
import { setGlobalFetch } from '@lcdev/fetch';

setGlobalFetch(fetch);
```

## Client Certificates

Some API servers require a client TLS certificate to authenticate against their API.
In NodeJS, you can do this using a custom HTTPS agent that is aware of the client certificate.
Then you can use `.withExtraOptions()` to pass the custom `agent` to the `fetch` options

_Note: `agent` is a non-standard option for `node-fetch`._

```typescript
import * as https from 'https';

const myApi = api('https://base-url.com')
  .withBearerToken({ token: '...' })
  .withExtraOptions({
    agent: new https.Agent({
      pfx: myPfxClientCertificate,
    }),
  });
```
