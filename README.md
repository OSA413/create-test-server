# create-test-server

> Creates a minimal Express server for testing

[Build Status]
[Coverage Status]
[![npm](https://img.shields.io/npm/dm/%40osa413/create-test-server.svg)](https://www.npmjs.com/package/@osa413/create-test-server)
[![npm](https://img.shields.io/npm/v/%40osa413/create-test-server.svg)](https://www.npmjs.com/package/@osa413/create-test-server)

Inspired by the `createServer()` helper function in the [Got tests](https://github.com/sindresorhus/got/blob/1f1b6ffb6da13f483ef7f6bd92dd33f022e7de47/test/helpers/server.js).

A simple interface for creating a preconfigured Express instance listening for HTTP traffic.

Ports are chosen at random for HTTP.

Created because mocking is dirty and can [break between Node.js releases](https://github.com/node-nock/nock/issues/922). Why mock HTTP requests when you can test locally against a real server in a few lines code?

## Install

```shell
npm i -D @osa413/create-test-server
```

## Usage

```js
import createTestServer from "@osa413/create-test-server";

const server = await createTestServer();
console.log(server.url);
// http://localhost:5486

// This is just an Express route
// You could use any Express middleware too
server.get('/foo', (req, res) => {
  res.send('bar');
});

// You can return a body directly too
server.get('/foo', () => 'bar');
server.get('/foo', 'bar');

// server.url + '/foo' will respond with 'bar'
```

The following `Content-Type` headers will be parsed and exposed via `req.body`:

- JSON (`application/json`)
- Text (`text/plain`)
- URL-encoded form (`application/x-www-form-urlencoded`)
- Buffer (`application/octet-stream`)

You can change body parsing behaviour with the [`bodyParser`](#optionsbodyparser) option.

`createTestServer()` has a Promise based API that pairs well with a modern asynchronous test runner such as [AVA](https://github.com/avajs/ava).

You can create a separate server per test:

```js
import test from 'ava';
import got from 'got';
import createTestServer from "@osa413/create-test-server";

test(async t => {
  const server = await createTestServer();
  server.get('/foo', 'bar');

  const response = await got(`${server.url}/foo`);
  t.is(response.body, 'bar');

  await server.close();
});
```

Or share a server across multiple tests:

```js
let server;

test.before(async () => {
  server = await createTestServer();
  server.get('/foo', 'bar');
});

test(async t => {
  const response = await got(`${server.url}/foo`);
  t.is(response.body, 'bar');
});

test(async t => {
  const response = await got(`${server.url}/foo`);
  t.is(response.statusCode, 200);
});

test.after(async () => {
	await server.close();
});
```

You can also easily stop/restart the server. Notice how a new port is used when we listen again:

```js
const server = await createTestServer();
console.log(server.port);
// 56711

await server.close();
console.log(server.port);
// undefined

await server.listen();
console.log(server.port);
// 56804
```

## API

### createTestServer([options])

Returns a Promise which resolves to an (already listening) server.

#### options

Type: `object`

##### options.bodyParser

Type: `object | boolean`<br>
Default: `undefined`

Body parser options object to be passed to [`body-parser`](https://github.com/expressjs/body-parser) methods.

If set to `false` then all body parsing middleware will be disabled.

### server

Express instance resolved from `createTestServer()`

This is just a normal Express instance with a few extra properties.

#### server.url

Type: `string`, `undefined`

The url you can reach the HTTP server on.

e.g: `'http://localhost:5486'`

`undefined` while the server is not listening.

#### server.port

Type: `number`, `undefined`

The port number you can reach the HTTP server on.

e.g: `5486`

`undefined` while the server is not listening.

#### server.http

Type: [`http.server`](https://nodejs.org/api/http.html#http_class_http_server)

The underlying HTTP server instance.

#### server.listen()

Type: `function`

Returns a Promise that resolves when the HTTP server is listening.

Once the server is listening, `server.url` will be updated.

Please note, this function doesn't take a port argument, it uses a new randomised port each time. Also, you don't need to manually call this after creating a server, it will start listening automatically.

#### server.close()

Type: `function`

Returns a Promise that resolves  when the HTTP server has stopped listening.

Once the servers have stopped listening, `server.url` will be set to `undefined`.
