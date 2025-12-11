/*** imports ***/
import fastJSON from "fast-json-stringify";
import findMyWay, { HTTPVersion } from "find-my-way";
import * as http from "http";
import { voidStageHandler } from "../stages/voidStageHandler";
import { DataType } from "./datatypes";
import { DefaultPipeErr, NotFoundPipeErr, PipeError } from "./error";
import { Router } from "./router";
import { HTTPContentType, HTTPMethod, HTTPStatus, Params, PipeContext, PipeCORSConfig, PipePressConfig, PipePressInjectOptions, PipePressInjectResponse, PipeResponse, PipeStage, PipeStageHandler } from "./types";
import inject from "light-my-request";

/*** definitions ***/
const DEFAULT_CONFIG: PipePressConfig = {
    maxBodyLength: 0,
}
const DEFAULT_CORS_CONFIG: Required<PipeCORSConfig> = {
    preflight: 'auto'
}

/*** class ***/
export class PipePress extends Router {
    /*** varbs ***/
    private _build = false;
    private _reqRouter: findMyWay.Instance<HTTPVersion.V1>
    private _server: http.Server | undefined;
    private _notFoundCustom: PipeStage<any> | undefined;
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
        /* add CORS stage if needed */
        if (this._pipePressConfig.cors) {
            this.use({ handler: this._corsStageHandler.bind(this) });
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
            this._reqRouter.on(route.method, route.path, async (req, res, params) => {
                /* create context for this route */
                const ctx = this._createContext(req, res, params);

                /* start executing all stages & handler */
                try {
                    /* stages */
                    if (route.stages) {
                        for (const stage of route.stages) {
                            const stageRes = await stage.handler(ctx);

                            if (stageRes) {
                                /* if stage returned something stop pipeline with response */
                                return this._sendResponse(res, stageRes);
                            }
                        }
                    }

                    /* main handler */
                    const mainRes = await route.handler(ctx);

                    if (mainRes) {
                        /* create a valid OK response */
                        this._sendResponse(res, {
                            status: HTTPStatus.OK,
                            body: mainRes,
                            serializer: route.serializer
                            // headers: ?? TODO
                        });
                    }
                    else {
                        /* route is a no content response */
                        this._sendResponse(res, { status: HTTPStatus.NO_CONTENT })
                    }
                }
                catch (e) {
                    this._handleError(e, ctx);
                }
            });
        }

        this._build = true;
    }

    listen(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this._build) reject(new Error('build() was not called'));
            if (this._server) reject(new Error('server is already running'));

            this._server = http.createServer((req, res) => {
                this._handleRequest(req, res);
            });

            this._server.listen(port, () => {
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
    setNotFoundHandler<T>(handler: PipeStageHandler<T>, response?: DataType<T, boolean>) {
        const notFoundStage: PipeStage<T> = {
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
    private _createContext(req: http.IncomingMessage, res: http.ServerResponse, params: Params): PipeContext<any> {
        /* extract query paramters */
        const reqURL = new URL(req.url || '', `http://${req.headers.host}`);   // TODO: base-url needed?
        const queryParams: Record<string, string> = {};
        for (const [param, value] of reqURL.searchParams.entries()) {
            queryParams[param] = value;
        }
        /* create context */
        const ctx: PipeContext<any, any, any> = {
            req,
            res,
            params,
            query: queryParams,
            body: undefined
        };
        return ctx;
    }
    private _sendResponse(res: http.ServerResponse, result: PipeResponse) {
        if (res.headersSent) return;
        /* set status */
        res.statusCode = result.status;

        /* set headers */
        if (result.headers) {
            for (const [head, val] of Object.entries(result.headers)) {
                res.setHeader(head, val);
            }
        }

        /* create data */
        let body: string;
        if (result.status === HTTPStatus.NO_CONTENT) {
            return res.end();
        }
        else if (typeof result.body === 'string') {
            res.setHeader('Content-Type', 'text/plain' as HTTPContentType);
            body = result.body;
        }
        else {
            /* TODO: allow other content types */
            res.setHeader('Content-Type', 'application/json' as HTTPContentType);
            body = result.serializer ? result.serializer(result.body) : JSON.stringify(result.body);
        }
        res.end(body);
    }
    private _handleError(e: any, ctx: PipeContext<any>) {
        // TODO: add custome error handler?
        try {
            if (e instanceof PipeError) {
                this._sendResponse(ctx.res, e.toPipeResponse());
            }
            else if (e instanceof Error) {
                const err = new DefaultPipeErr(e);
                this._sendResponse(ctx.res, err.toPipeResponse());
            }
            else {
                const err = new DefaultPipeErr(new Error(e?.toString() || 'Unknown error'));
                this._sendResponse(ctx.res, err.toPipeResponse());
            }
        }
        catch (e) {
            /* double failer -> make it clear for logging or somehting like this */
            console.log(e); // TODO:
        }
    }
    private async _handleNotFound(req: http.IncomingMessage, res: http.ServerResponse) {
        /* create context for this route */
        const ctx = this._createContext(req, res, {});

        /* start executing all global stages */
        try {
            /* stages */
            for (const stage of this._stages) {
                const stageRes = await stage.handler(ctx);

                if (stageRes) {
                    /* if stage returned something stop pipeline with response */
                    return this._sendResponse(res, stageRes);
                }
            }

            /* run not found handler */
            if (this._notFoundCustom) {
                const res = await this._notFoundCustom.handler(ctx);
                if (res) {
                    /* if the handler did not set a serializer, use the custom one */
                    if (!res.serializer && this._notFoundCustom.serializer) {
                        res.serializer = this._notFoundCustom.serializer;
                    }
                    this._sendResponse(ctx.res, res);
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
                throw new NotFoundPipeErr(req.method as HTTPMethod, req.url || '');
            }
        }
        catch (e) {
            this._handleError(e, ctx);
        }
    }
    private _corsStageHandler(ctx: PipeContext<any>) {
        /* ORIGIN */
        ctx.res.setHeader('Access-Control-Allow-Origin', '*');  // TODO: make configurable
        /* METHODS */
        const allowedMethods = this._allowedMethods[ctx.req.url || ''];
        if (allowedMethods) {
            ctx.res.setHeader('Access-Control-Allow-Methods', Array.from(allowedMethods).join(', '));
        }
        /* HEADERS */
        const allowedHeaders = ctx.req.headers['access-control-request-headers']; // TODO: make configurable
        if (allowedHeaders && allowedHeaders.length > 0) {
            ctx.res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
        }
    }
}