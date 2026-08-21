/*** imports ***/
import fastJSON from "fast-json-stringify";
import findMyWay, { HTTPVersion } from "find-my-way";
import * as http from "http";
import { voidStageHandler } from "../stages/voidStageHandler";
import { DataType } from "./datatypes";
import { InternalPipeErr, RouteNotFoundPipeErr, PipeError } from "./error";
import { Router } from "./router";
import { HTTPContentType, HTTPMethod, HTTPStatus, ParamsType, PipeContext, PipeCORSConfig, PipePressConfig, PipePressEvents, PipePressInjectOptions, PipePressInjectResponse, PipeResponse, PipeStage, PipeStageHandler } from "./models";
import inject from "light-my-request";
import { isPipeResponse, pipeResponse, setCookie } from "./utils";

/*** types ***/
type RouteStore = {
    pattern: string
}

/*** definitions ***/
const DEFAULT_CONFIG: PipePressConfig = {
    maxBodyLength: 0,
}
const DEFAULT_CORS_CONFIG: Required<PipeCORSConfig> = {
    preflight: 'auto'
}

/*** class ***/
export class PipePress<GlobalState = {}> extends Router<GlobalState, PipePressEvents> {
    /*** varbs ***/
    private _build = false;
    private _reqRouter: findMyWay.Instance<HTTPVersion.V1>
    private _server: http.Server | undefined;
    private _notFoundCustom: PipeStage<any, any> | undefined;
    private _pipePressConfig: PipePressConfig;
    private _allowedMethods: Record<string, Set<HTTPMethod>> = {};

    constructor(options: PipePressConfig = {}) {
        super({ ...options });
        this._reqRouter = findMyWay({
            ignoreTrailingSlash: true,
            ignoreDuplicateSlashes: true
        });
        /* merge configs */
        this._pipePressConfig = { ...DEFAULT_CONFIG, ...options };
        if (this._pipePressConfig.cors) {
            this._pipePressConfig.cors = { ...DEFAULT_CORS_CONFIG, ...this._pipePressConfig.cors };
        }
    }

    /*** public functions ***/
    build() {
        if (this._build) throw new Error('build() was already called');

        const allRoutes = this.collectRoutes();

        /* generate CORS data */
        if (this._pipePressConfig.cors) {
            /* create map for all paths and their allowed methods */
            for (const route of allRoutes) {
                if (!this._allowedMethods[route.path]) {
                    this._allowedMethods[route.path] = new Set();
                }
                this._allowedMethods[route.path].add(route.method);
                /* add OPTIONS method if preflight is auto */
                if (this._pipePressConfig.cors.preflight === 'auto') {
                    this._allowedMethods[route.path].add('OPTIONS');
                }
            }

            /* generate OPTIONS routes for all paths */
            if (this._pipePressConfig.cors.preflight === 'auto') {
                for (const [path, methods] of Object.entries(this._allowedMethods)) {
                    allRoutes.push({
                        method: 'OPTIONS',
                        path: path,
                        stages: [...this._stages],
                        handler: voidStageHandler,
                        serializer: JSON.stringify  // will not be called anyway
                    });
                }
            }
        }

        /* create pipline and handler for route and register */
        for (const route of allRoutes) {
            this._reqRouter.on(route.method, route.path, async (req, res, params, store: RouteStore, _searchParams) => {
                /* create context for this route */
                const ctx = this._createContext(req, res, params);
                const state = {} as any;
                /* start executing all stages & handler */
                try {
                    /* run CORS stage if needed */
                    if (this._pipePressConfig.cors) {
                        this._corsStageHandler(ctx, store.pattern);
                    }
                    /* stages */
                    if (route.stages) {
                        for (const stage of route.stages) {
                            const stageRes = await stage.handler(ctx, state);

                            if (stageRes) {
                                /* if stage returned something stop pipeline with response */
                                return this._sendResponse(ctx, stageRes);
                            }
                        }
                    }

                    /* main handler */
                    const mainRes = await route.handler(ctx, state);

                    if (isPipeResponse(mainRes)) {
                        this._sendResponse(ctx, mainRes);
                    }
                    else if (mainRes) {
                        /* create a valid OK response */
                        this._sendResponse(ctx, pipeResponse({
                            status: HTTPStatus.OK,
                            body: mainRes,
                            serializer: route.serializer,
                            contentType: route.contentType,
                            // headers: ?? TODO
                        }))
                    }
                    else {
                        /* route is a no content response */
                        this._sendResponse(ctx, pipeResponse({ status: HTTPStatus.NO_CONTENT }));
                    }
                }
                catch (e) {
                    this._handleError(e, ctx);
                }
                finally {
                    /* temp file cleanup */
                    if (ctx.files) {
                        /* loop over files and delete temp files */
                        for (const filedName in ctx.files) {
                            const files = ctx.files[filedName];
                            if (files) {
                                for (const file of files) {
                                    /* async delete the file */
                                    import('fs').then(fs => {
                                        fs.unlink(file.path, (err) => {
                                            if (err) {
                                                this._emit('unlink_failed', file.path, err);
                                            }
                                        });
                                    });
                                }
                            }
                        }
                    }
                    /* make sure socket is finished */
                    this._cleanupSocket(ctx);
                }
            }, { pattern: route.path } as RouteStore);
        }

        this._build = true;
    }

    listen(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._build) reject(new Error('build() was not called'));
            if (this._server) reject(new Error('server is already running'));

            /* create server and setup handler */
            this._server = http.createServer((req, res) => {
                this._handleRequest(req, res);
            });
            
            /* setup startup-error handler */
            this._server.once('error', (err) => {
                reject(err);
            });

            /* start server */
            this._server.listen(port, () => {
                /* clean error listener */
                this._server?.removeAllListeners('error');

                /* setup finally listener */
                this._server!.on('error', (err) => {
                    this._emit('error', err);
                });
                this._server!.on('clientError', (err, socket) => {
                    this._emit('clientError', err);
                });

                /* finish startup */
                resolve();
            });
        });
    }

    close(): Promise<void> {
        return new Promise((res, rej) => {
            if (this._server) {
                /* start server closing */
                this._server.close((err) => {
                    if (err) rej(err);
                    else res();
                });
                /* force close all open connections */
                this._server.closeAllConnections();
            }
            else {
                res();
            }
        });
    }

    // TODO: remove serializer in the PipeStageHandler response?
    setNotFoundHandler<T, Extra = {}>(handler: PipeStageHandler<T, Extra>, response?: DataType<T, boolean>) {
        const notFoundStage: PipeStage<T, Extra> = {
            handler: handler
        };
        if (response) {
            notFoundStage.serializer = fastJSON(response.toJSONSchema() as any);
        }
        this._notFoundCustom = notFoundStage;
    }

    prittyPrintRoutes(): string {
        if (!this._build) throw new Error('build() was not called');
        return this._reqRouter.prettyPrint();
    }

    async inject(options: PipePressInjectOptions): Promise<PipePressInjectResponse> {
        const res = await inject(
            this._handleRequest.bind(this),
            {
                method: options.method,
                url: options.url,
                headers: options.headers,
                payload: options.body
            }
        );

        /* create response data */
        const buf = Buffer.from(res.rawPayload || "");
        const str = buf.toString();

        return {
            statusCode: res.statusCode,
            headers: res.headers as Record<string, string>,
            body: str,
            json: <T = any>() => {
                try {
                    return JSON.parse(str) as T;
                } catch {
                    throw new Error("Response is not valid JSON");
                }
            },
            text: () => str,
            raw: () => buf,
        };
    }

    /*** private functions ***/
    private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        const match = this._reqRouter.find(req.method as HTTPMethod || 'GET', req.url || '');

        if (match) {
            match.handler(req, res, match.params, match.store, match.searchParams);
        }
        else {
            /* call not-Found handler */
            this._handleNotFound(req, res);
        }
    }
    private _createContext(req: http.IncomingMessage, res: http.ServerResponse, params: ParamsType): PipeContext<any, any> {
        /* create query parameters */
        let query: Record<string, string> = {};
        if (req.url) {
            const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
            query = Object.fromEntries(url.searchParams.entries())
        }
        /* create context */
        const ctx: PipeContext<any, any> = {
            req,
            res,
            params,
            query,
            body: undefined,
            files: undefined,
            cookies: undefined,
            rawCookies: {},
            rawBody: undefined
        };
        return ctx;
    }
    private _sendResponse(ctx: PipeContext<any, any>, result: PipeResponse) {
        if (ctx.res.headersSent) return;
        /* set status */
        ctx.res.statusCode = result.status;

        /* set headers */
        if (result.headers) {
            for (const [head, val] of Object.entries(result.headers)) {
                ctx.res.setHeader(head, val);
            }
        }
        /* set terminate header */
        if (result.terminate) {
            ctx.res.setHeader('Connection', 'close');
        }

        /* set cookies */
        if (result.cookies) {
            for (const { name, value, ...opts } of result.cookies) {
                setCookie(ctx.res, name, value, opts);
            }
        }

        /* check for content type */
        const contentType: HTTPContentType = result.contentType || 'application/json';

        /* create data */
        let body: any;  // string or buffer
        if (result.status === HTTPStatus.NO_CONTENT) {
            return ctx.res.end();
        }
        else if (contentType !== 'application/json') {
            ctx.res.setHeader('Content-Type', contentType);
            body = result.body;
        }
        else {
            /* TODO: allow other content types */
            ctx.res.setHeader('Content-Type', 'application/json' as HTTPContentType);
            body = result.serializer ? result.serializer(result.body) : JSON.stringify(result.body);
        }
        /* send body / responst */
        ctx.res.end(body);

        /* wait for finish to terminate if requested */
        if (result.terminate) {
            ctx.res.on('finish', () => {
                ctx.req.destroy();
            });
        }
    }
    private _handleError(e: any, ctx: PipeContext<any, any>) {
        // TODO: add custome error handler?
        try {
            if (e instanceof PipeError) {
                this._sendResponse(ctx, e.toPipeResponse());
            }
            else if (e instanceof Error) {
                const err = new InternalPipeErr(e);
                this._sendResponse(ctx, err.toPipeResponse());
            }
            else {
                const err = new InternalPipeErr(new Error(e?.toString() || 'Unknown error'));
                this._sendResponse(ctx, err.toPipeResponse());
            }
        }
        catch (e) {
            /* double failer emit error */
            let err = e instanceof Error ? e : new Error(`${e}`);
            this._emit('unable_to_response', err);
        }
    }
    private async _handleNotFound(req: http.IncomingMessage, res: http.ServerResponse) {
        /* create context for this route */
        const ctx = this._createContext(req, res, {});
        const state = {} as any;
        /* start executing all global stages */
        try {
            /* stages */
            for (const stage of this._stages) {
                const stageRes = await stage.handler(ctx, state);

                if (stageRes) {
                    /* if stage returned something stop pipeline with response */
                    return this._sendResponse(ctx, stageRes);
                }
            }

            /* run not found handler */
            if (this._notFoundCustom) {
                const res = await this._notFoundCustom.handler(ctx, state);
                if (res) {
                    /* if the handler did not set a serializer, use the custom one */
                    if (!res.serializer && this._notFoundCustom.serializer) {
                        res.serializer = this._notFoundCustom.serializer;
                    }
                    this._sendResponse(ctx, res);
                }
                /**
                 * TODO:
                 * the custom handler did not return anything, throw default error?
                 * IF the handler already send a response, the sendResponse message will not sent again
                 */
                // throw new NotFoundPipeErr(req.method as HTTPMethod, req.url || '');
            }
            else {
                /* create default not repsonse by throwing error*/
                throw new RouteNotFoundPipeErr(req.method as HTTPMethod, req.url || '');
            }
        }
        catch (e) {
            this._handleError(e, ctx);
        }
        finally {
            /* make sure socket is finished */
            this._cleanupSocket(ctx);
        }
    }
    private _corsStageHandler(ctx: PipeContext<any, any>, path: string) {
        /* ORIGIN */
        ctx.res.setHeader('Access-Control-Allow-Origin', '*');  // TODO: make configurable
        /* METHODS */
        const allowedMethods = this._allowedMethods[path];
        if (allowedMethods) {
            ctx.res.setHeader('Access-Control-Allow-Methods', Array.from(allowedMethods).join(', '));
        }
        /* HEADERS */
        const allowedHeaders = ctx.req.headers['access-control-request-headers']; // TODO: make configurable
        if (allowedHeaders && allowedHeaders.length > 0) {
            ctx.res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
        }
    }
    private _cleanupSocket(ctx: PipeContext<any, any>) {
        if (ctx.res.socket && !ctx.res.socket.destroyed) {
            ctx.res.socket.destroy();
        }
    }
}