
import * as createTestServer from '../src';

import * as querystring from 'querystring';
import * as got from 'got';

test('server instance exposes useful properties', async () => {
	const server = await createTestServer();

	expect(typeof server.port === 'number').toBeTruthy();
	expect(typeof server.url === 'string').toBeTruthy();
	expect(typeof server.listen === 'function').toBeTruthy();
	expect(typeof server.close === 'function').toBeTruthy();
});

test('express endpoint', async () => {
	const server = await createTestServer();

	server.get('/foo', (req, res) => {
		res.send('bar');
	});

	const { body } = await got(server.url + '/foo');
	expect(body).toEqual('bar');
});

test('server can be stopped and restarted', async () => {
	const server = await createTestServer();

	server.get('/foo', (req, res) => {
		res.send('bar');
	});

	const { body } = await got(server.url + '/foo');
	expect(body).toEqual('bar');

	const closedUrl = server.url;
	await server.close();

	await got(closedUrl + '/foo', { timeout: 100 }).catch(err => {
		expect(err.code).toEqual('ETIMEDOUT');
	});

	await server.listen();

	const { body: bodyRestarted } = await got(server.url + '/foo');
	expect(bodyRestarted).toEqual('bar');
});

test('server uses a new port on each listen', async () => {
	const server = await createTestServer();
	const origPort = server.port;
	await server.close();
	await server.listen();

	expect(origPort).not.toEqual(server.port);
});

test('server automatically parses JSON request body', async () => {
	const server = await createTestServer();
	const object = { foo: 'bar' };

	server.post('/echo', (req, res) => {
		expect(req.body).toEqual(object);
		res.end();
	});

	await got.post(server.url + '/echo', {
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(object)
	});
});

test('server automatically parses text request body', async () => {
	const server = await createTestServer();
	const text = 'foo';

	server.post('/echo', (req, res) => {
		expect(req.body).toEqual(text);
		res.end();
	});

	await got.post(server.url + '/echo', {
		headers: { 'content-type': 'text/plain' },
		body: text
	});
});

test('server automatically parses URL-encoded form request body', async () => {
	const server = await createTestServer();
	const object = { foo: 'bar' };

	server.post('/echo', (req, res) => {
		expect(req.body).toEqual(object);
		res.end();
	});

	await got.post(server.url + '/echo', {
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: querystring.stringify(object)
	});
});

test('server automatically parses binary request body', async () => {
	const server = await createTestServer();
	const buffer = Buffer.from('foo');

	server.post('/echo', (req, res) => {
		expect(req.body).toEqual(buffer);
		res.end();
	});

	await got.post(server.url + '/echo', {
		headers: { 'content-type': 'application/octet-stream' },
		body: buffer
	});
});

test('opts.bodyParser is passed through to bodyParser', async () => {
	const smallServer = await createTestServer({ bodyParser: { limit: '100kb' } });
	const bigServer = await createTestServer({ bodyParser: { limit: '200kb' } });
	const buf = Buffer.alloc(150 * 1024);

	// Custom error handler so we don't dump the stack trace in the test output
	smallServer.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
		res.status(500).end();
	});

	smallServer.post('/', (req, res) => {
		throw new Error("This should not happen")
		res.end();
	});

	bigServer.post('/', (req, res) => {
		expect(req.body.length === buf.length).toBeTruthy();
		res.end();
	});

	// TODO: Rewrite
	// await t.throws(got.post(smallServer.url, {
	// 	headers: { 'content-type': 'application/octet-stream' },
	// 	body: buf
	// }));

	// await t.notThrows(got.post(bigServer.url, {
	// 	headers: { 'content-type': 'application/octet-stream' },
	// 	body: buf
	// }));
});

test('if opts.bodyParser is false body parsing middleware is disabled', async () => {
	const server = await createTestServer({ bodyParser: false });
	const text = 'foo';

	server.post('/echo', (req, res) => {
		expect(req.body).toEqual(undefined);
		res.end();
	});

	await got.post(server.url + '/echo', {
		headers: { 'content-type': 'text/plain' },
		body: text
	});
});

test('support returning body directly', async () => {
	const server = await createTestServer();

	server.get('/foo', () => 'bar');
	server.get('/bar', () => ({ foo: 'bar' }));
	server.get('/async', () => Promise.resolve('bar'));

	const bodyString = (await got(server.url + '/foo')).body;
	const bodyJson = (await got(server.url + '/bar', { json: true })).body;
	const bodyAsync = (await got(server.url + '/async')).body;
	expect(bodyString).toEqual('bar');
	expect(bodyJson).toEqual({ foo: 'bar' });
	expect(bodyAsync).toEqual('bar');
});

test('support returning body directly without wrapping in function', async () => {
	const server = await createTestServer();

	server.get('/foo', 'bar');
	server.get('/bar', ({ foo: 'bar' }));
	server.get('/async', Promise.resolve('bar'));

	const bodyString = (await got(server.url + '/foo')).body;
	const bodyJson = (await got(server.url + '/bar', { json: true })).body;
	const bodyAsync = (await got(server.url + '/async')).body;
	expect(bodyString).toEqual('bar');
	expect(bodyJson).toEqual({ foo: 'bar' });
	expect(bodyAsync).toEqual('bar');
});

test('accepts multiple callbacks in `.get()`', async () => {
	const server = await createTestServer();

	server.get('/foo', (req, res, next) => {
		res.set('foo', 'bar');
		next();
	}, (req, res) => res.get('foo'));

	const { body } = await got(server.url + '/foo');
	expect(body).toEqual('bar');
});

test('raw http server is exposed', async () => {
	const server = await createTestServer();

	expect(server.http.listening).toBeTruthy();

	await server.close();

	expect(server.http.listening).toBeFalsy();
});
