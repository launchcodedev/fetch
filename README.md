# Fetch
Tiny wrapper around DOM fetch for common API wrappings.

```bash
yarn add @servall/fetch@0.1
```

Use:

```typescript
import { HttpMethod, api, apiCall } from '@servall/fetch';

const myCoreApi = api('https://base-url.com');

await myCoreApi.get('/endpoint').withBody({ foo: 'bar' });
```

Requests start on await/then. Chain to add pieces to the request. 'Api's can
have global 'transforms' which can do things with `withBearerToken`, `onResponse`,
etc.
