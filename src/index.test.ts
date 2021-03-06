import * as http from 'http';
import * as https from 'https';
import { HttpMethod, buildPath, api, apiCall } from './index';

import 'cross-fetch/polyfill';

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('buildings paths', () => {
  test('basic additions', () => {
    expect(buildPath('https://servalldev.com', 'api-call')).toBe('https://servalldev.com/api-call');
    expect(buildPath('https://servalldev.com/', '/api-call')).toBe(
      'https://servalldev.com/api-call',
    );
    expect(buildPath('https://servalldev.com/api', '/call')).toBe(
      'https://servalldev.com/api/call',
    );
    expect(buildPath('//servalldev.com', '/call')).toBe('//servalldev.com/call');
    expect(buildPath('/api-call')).toBe('/api-call');
  });
});

describe('building api calls', () => {
  test('api call build', () => {
    expect(api('//base').get('/api').build()).toEqual({
      method: 'GET',
      path: '//base/api',
      headers: new Headers(),
    });

    expect(api('//base').post('/api').build()).toEqual({
      method: 'POST',
      path: '//base/api',
      headers: new Headers(),
    });

    expect(api('//base').get('/api').withContentType('fake/mime').build()).toEqual({
      method: 'GET',
      path: '//base/api',
      headers: new Headers({
        'content-type': 'fake/mime',
      }),
    });

    expect(
      api('//base')
        .get('/api')
        .withHeaders(
          new Headers({
            Fake: 'stuff',
          }) as any,
        )
        .build(),
    ).toEqual({
      method: 'GET',
      path: '//base/api',
      headers: new Headers({
        fake: 'stuff',
      }),
    });

    expect(
      api('//base')
        .get('/api')
        .withBody({
          foo: 'bar',
        })
        .build(),
    ).toEqual({
      method: 'GET',
      path: '//base/api',
      headers: new Headers({
        'content-type': 'application/json',
      }),
      body: JSON.stringify({ foo: 'bar' }),
    });
  });
});

describe('api transforms', () => {
  test('api transforms', () => {
    const test = api('//foo').withBearerToken({ token: 'auth-token' });

    expect(test.get('api').build()).toEqual({
      method: 'GET',
      path: '//foo/api',
      headers: new Headers({
        authorization: 'Bearer auth-token',
      }),
    });

    const test2 = api('//foo').withTransform((c) => c.withQuery({ e: true }));

    expect(test2.get('api').build()).toEqual({
      method: 'GET',
      path: '//foo/api?e=true',
      headers: new Headers(),
    });
  });

  test('method specific transform', () => {
    const test3 = api('//foo').withTransform([HttpMethod.PUT, (c) => c.withQuery({ e: true })]);

    expect(test3.get('api').build()).toEqual({
      method: 'GET',
      path: '//foo/api',
      headers: new Headers(),
    });

    expect(test3.put('api').build()).toEqual({
      method: 'PUT',
      path: '//foo/api?e=true',
      headers: new Headers(),
    });
  });

  test('with bearer', () => {
    const test4 = api('//foo').withBearerToken({ token: undefined });

    expect(test4.get('api').build()).toEqual({
      method: 'GET',
      path: '//foo/api',
      headers: new Headers({}),
    });
  });

  test('with base url', () => {
    const test5 = api('//foo').withBaseURL('/api/v1');

    expect(test5.get('bar').build()).toEqual({
      method: 'GET',
      path: '//foo/api/v1/bar',
      headers: new Headers({}),
    });
  });

  test('with base url and transform', () => {
    const test = api('//foo').withBearerToken({ token: 'token' });
    const test1 = test.withBaseURL('/api/v1');

    expect(test.get('bar').build()).toEqual({
      method: 'GET',
      path: '//foo/bar',
      headers: new Headers({
        authorization: 'Bearer token',
      }),
    });

    expect(test1.get('bar').build()).toEqual({
      method: 'GET',
      path: '//foo/api/v1/bar',
      headers: new Headers({
        authorization: 'Bearer token',
      }),
    });
  });

  test('change api base url', () => {
    const myApi = api('https://my-api');

    expect(myApi.get('/api').build()).toMatchObject({
      method: 'GET',
      path: 'https://my-api/api',
    });

    myApi.changeBaseURL('https://my-other-api/');

    expect(myApi.get('/api').build()).toMatchObject({
      method: 'GET',
      path: 'https://my-other-api/api',
    });
  });
});

describe('extra options', () => {
  test('agent option', async () => {
    const customAgent = new https.Agent();
    expect(
      apiCall('/', HttpMethod.GET).withExtraOptions({ agent: customAgent }).build(),
    ).toMatchObject({
      path: '/',
      agent: customAgent,
    });
  });

  test('multiple extra options call', async () => {
    expect(
      apiCall('/', HttpMethod.GET)
        .withExtraOptions({ first: 'abc' })
        .withExtraOptions({ second: 'def' })
        .build(),
    ).toMatchObject({
      path: '/',
      first: 'abc',
      second: 'def',
    });
  });

  test('extra options overwrite other builders', async () => {
    expect(
      apiCall('/', HttpMethod.GET).withExtraOptions({ path: '/other', method: 'POST' }).build(),
    ).toMatchObject({
      path: '/other',
      method: 'POST',
    });
  });
});

test('api on response', async () => {
  const server = http
    .createServer(({ method }, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          method,
          foo: 'bar',
          baz: 'bat',
        }),
      );
    })
    .listen(0);

  const { port } = server.address() as { port: number };

  const test = api(`http://localhost:${port}`)
    .onResponse((res) => {
      expect(res.status).toEqual(200);
    })
    .onJsonResponse((res) => {
      expect(res).toMatchObject({
        foo: 'bar',
        baz: 'bat',
      });
    });

  await test.get('/fake').json();
  await test.patch('/fake').json();
  await test.delete('/fake').json();
  await test.head('/fake');
  await test.options('/fake');

  expect((await test.get('/fake').blob()).toString()).toBe('[object Blob]');

  server.close();
});

test('api on pre build modifies auth token', async () => {
  const server = http
    .createServer(({ headers }, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          headers,
        }),
      );
    })
    .listen(0);

  const { port } = server.address() as { port: number };

  const auth = {
    token: 'abc',
  };

  const test = api(`http://localhost:${port}`)
    .withBearerToken(auth)
    .onPreBuild(() => {
      auth.token = 'def';
    })
    .onResponse((res) => {
      expect(res.status).toEqual(200);
    })
    .onJsonResponse((res) => {
      expect(res).toMatchObject({
        headers: {
          authorization: `Bearer def`,
        },
      });
    });

  await test.get('/fake').json();
  await test.patch('/fake').json();
  await test.delete('/fake').json();
  await test.head('/fake');
  await test.options('/fake');

  server.close();
});

test('double call api call', async () => {
  const server = http
    .createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          foo: 'bar',
          baz: 'bat',
        }),
      );
    })
    .listen(0);

  const { port } = server.address() as { port: number };

  const call = apiCall(`http://localhost:${port}`, HttpMethod.GET);

  expect.assertions(5);

  await expect(call.json()).resolves.toEqual({ foo: 'bar', baz: 'bat' });
  await expect(call.json()).rejects.toThrow();
  await expect(call.then()).rejects.toThrow();

  await expect(call.catch(() => {})).resolves.toBe(undefined);
  await call.finally(() => expect(true).toBe(true)).catch(() => {});

  server.close();
});

test('expect status', async () => {
  const server = http
    .createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({}));
    })
    .listen(0);

  const { port } = server.address() as { port: number };

  await expect(
    apiCall(`http://localhost:${port}`, HttpMethod.GET).expectStatus(400),
  ).rejects.toThrow();

  await expect(
    apiCall(`http://localhost:${port}`, HttpMethod.GET).expectStatus(200),
  ).resolves.toBeTruthy();

  server.close();
});

test('expect successful status', async () => {
  const server = http
    .createServer((_, res) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Something went wrong' }));
    })
    .listen(0);

  const { port } = server.address() as { port: number };

  await expect(
    apiCall(`http://localhost:${port}`, HttpMethod.GET).expectSuccessStatus(),
  ).rejects.toThrow();

  server.close();
});

describe('serialization options', () => {
  test('strip empty strings', () => {
    expect(
      apiCall('/foo', HttpMethod.GET).withQuery({ bar: 1, baz: '' }, {}).build(),
    ).toMatchObject({
      path: '/foo?bar=1&baz=',
    });

    expect(
      apiCall('/foo', HttpMethod.GET)
        .withQuery({ bar: 1, baz: '' }, { stripEmptyStrings: true })
        .build(),
    ).toMatchObject({
      path: '/foo?bar=1',
    });

    expect(
      apiCall('/foo', HttpMethod.GET)
        .withBody({ bar: 1, baz: '' }, true, { stripEmptyStrings: true })
        .build(),
    ).toMatchObject({
      body: JSON.stringify({ bar: 1 }),
    });

    expect(apiCall('/foo', HttpMethod.GET).withBody({ bar: 1, baz: '' }).build()).toMatchObject({
      body: JSON.stringify({ bar: 1, baz: '' }),
    });

    expect(apiCall('/foo', HttpMethod.POST).withBody([1, 2, 3]).build()).toMatchObject({
      body: JSON.stringify([1, 2, 3]),
    });
  });

  test('form data', () => {
    expect(apiCall('/', HttpMethod.POST).withFormDataBody({ foo: 'bar' }).build()).toMatchObject({
      path: '/',
      body: expect.any(FormData),
    });
  });

  test('url encoded', () => {
    expect(apiCall('/', HttpMethod.POST).withURLEncodedBody({ foo: 'bar' }).build()).toMatchObject({
      path: '/',
      headers: new Headers({
        'content-type': 'application/x-www-form-urlencoded',
      }),
      body: expect.any(URLSearchParams),
    });
  });
});
