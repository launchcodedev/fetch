# Fetch
Tiny wrapper around DOM fetch for common API wrappings.

```bash
yarn add @lcdev/fetch@0.1
```

Use:

```typescript
import { HttpMethod, api, apiCall } from '@lcdev/fetch';

// re-use this any time you want to make a call to this api
const myCoreApi = api('https://base-url.com');

// calling .then or `await` triggers the request
await myCoreApi.get('/endpoint')
  // chainable interface
  .withBody({ foo: 'bar' })
  .withQuery({ baz: 'bat' })
  // chain .json if you know the response is json
  .json<MyReturnType>();

// don't need to define a base URL up front for one-offs
await apiCall('https://base-url.com/endpoint').json<MyReturnType>();
```

Requests start on await/then. Chain to add data to the request. This is just a thin way to make `fetch` calls.

'Api's can have global 'transforms' which can do things with `withBearerToken`, `onResponse`, etc.
The common use is for authorization tokens.

```typescript
// let's assume that this is something that manages the current token
const authManager = {
  token: '...',
};

const myCoreApi = api('https://base-url.com')
  // whenever a request is made, this gets `authManager.token` and attachs it to the Authorization header
  .withBearerToken(authManager);
```

You can add little callbacks to `myCoreApi` using `onResponse` or `onJsonResponse`. You might
do so to watch for 401 responses, or maybe just for logging.

Chainable methods for API calls:
- `withBody(object, isJson?: boolean)`: adds json or other type of request body
- `withQuery(object)`: adds query parameters
- `withBearerToken(BearerToken)`: adds Authorization: Bearer {token} header
- `withContentType(string)`: changes default content type header
- `withHeaders(Headers)`: adds headers to request
- `withHeader(key, value)`: adds a header to the request
- `expectStatus(number)`: throw error is response status isn't the expect one
- `build()`: constructs options that can be passed into `fetch`
- `json<T>()`: calls fetch and parses response as JSON
- `jsonAndResponse<T>()`: calls fetch and parses response as JSON, along with full Response
- `blob<T>()`: calls fetch and parses response as a blob
- `blobAndResponse<T>()`: calls fetch and parses response as a blob, along with full Response

A base API itself can be called with `.get`, `.post`, etc. You can change the base URL if required
with `changeBaseURL(path)`, though be warned that every request from then on will then be based on that.
