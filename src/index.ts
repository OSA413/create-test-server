"use strict";

import http from "http";
import { AddressInfo } from "net";
import express from "express";
import pify from "pify";
import bodyParser, { OptionsJson, OptionsText, OptionsUrlencoded } from "body-parser";

// Thank @midgleyc for providing the type definitions
export type TestServer = TestServerWrapper
    & Omit<express.Express, 'listen'>
    & {get: (url: string, response: unknown) => void};

export interface Options {
    /**
     * Body parser options object to be passed to `body-parser` methods.
     *
     * If set to `false` then all body parsing middleware will be disabled.
     */
    bodyParser?: false |
        OptionsJson
        & OptionsText
        & OptionsUrlencoded;
}

export interface TestServerWrapper {
    /**
     * The url you can reach the HTTP server on.
     *
     * e.g: `'http://localhost:5486'`
     *
     * `undefined` while the server is not listening.
     */
    url?: string;
    /**
     * The port number you can reach the HTTP server on.
     *
     * e.g: `5486`
     *
     * `undefined` while the server is not listening.
     */
    port?: number;
    /**
     * The underlying HTTP server instance.
     */
    http: http.Server;
    /**
     * Returns a Promise that resolves when the HTTP server is listening.
     *
     * Once the server is listening, `server.url` will be updated.
     *
     * Please note, this function doesn't take a port argument, it uses a new randomised port each time.
     * Also, you don't need to manually call this after creating a server, it will start listening automatically.
     */
    listen: () => Promise<void>;
    /**
     * Returns a Promise that resolves when the HTTP server has stopped listening.
     *
     * Once the servers have stopped listening, `server.url` will be set to undefined.
     */
    close: () => Promise<void>;
}

export const createTestServer = (opts: Options = {}): Promise<TestServer> => {
    const _express = express();
    const server = _express as never as TestServer;
    server.http = http.createServer(_express);

    server.set("etag", false);

    if (opts.bodyParser !== false) {
        server.use(bodyParser.json(Object.assign({ limit: "1mb", type: "application/json" }, opts.bodyParser)));
        server.use(bodyParser.text(Object.assign({ limit: "1mb", type: "text/plain" }, opts.bodyParser)));
        server.use(bodyParser.urlencoded(Object.assign({ limit: "1mb", type: "application/x-www-form-urlencoded", extended: true }, opts.bodyParser)));
        server.use(bodyParser.raw(Object.assign({ limit: "1mb", type: "application/octet-stream" }, opts.bodyParser)));
    }

    // The handler that processes functions and values as the same
    const send = (fn: express.RequestHandler | string) => (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
    ) => {
        const cb = typeof fn === "function" ? fn(req, res, next) : fn;

        Promise.resolve(cb).then(val => {
            if (val) {
                res.send(val);
            }
        });
    };

    const get = server.get.bind(server);
    server.get = function () {
        const [path, ...handlers] = [...arguments];

        for (const handler of handlers) {
            get(path, send(handler));
        }
    } as any;

    server.listen = () => pify(server.http.listen.bind(server.http))().then(() => {
        server.port = (server.http.address() as AddressInfo).port;
        server.url = `http://localhost:${server.port}`;
    });

    server.close = () => pify(server.http.close.bind(server.http))().then(() => {
        server.port = undefined;
        server.url = undefined;
    });

    return server.listen().then(() => server);
};
