# Fetch
Tiny wrapper around DOM fetch for common API wrappings.

```bash
yarn add @lcdev/fetch@0.1
```

Use:

```typescript
import { HttpMethod, api, apiCall } from '@lcdev/fetch';

// re-use this any time you want to make a call to this api
const myCoreApi = api('https://base-url.com')
  // add transforms like this - lets you intercept any response
  .onResponse(callback)
  .onJsonResponse(callback)
  // attach bearer token header to all requests
  .withBearerToken(authManager);

// calling .then or `await` triggers the request
await myCoreApi.get('/endpoint')
  // chainable interface
  .withBody({ foo: 'bar' })
  .withQuery({ baz: 'bat' })
  // chain .json if you know the response is json
  .json<MyReturnType>();
```

Requests start on await/then. Chain to add pieces to the request. 'Api's can
have global 'transforms' which can do things with `withBearerToken`, `onResponse`,
etc.
