/*** imports ***/
import findMyWay, { Handler, HTTPVersion } from "find-my-way";
import * as http from "http";
import { Router } from "./router";
import { HTTPContentType, HTTPMethod, HTTPStatus, Params, PipeContext, PipeResponse, PipeRoute, PipeStage, RouteCompiled } from "./types";
import { DefaultPipeErr, NotFoundPipeErr, PipeError } from "./error";
import { optionsRequestRoute } from "../stages/optionsHandler";

/*** class ***/
export class PipePress extends Router {
    /*** varbs ***/
    private _build = false;
    private _reqRouter: findMyWay.Instance<HTTPVersion.V1>
    private _server: http.Server | undefined;
    private _allowedMethods: Set<HTTPMethod> = new Set();
    private _notFoundHandler: PipeRoute<any> | undefined;   // TODO: add method to use one handler

    constructor() {
        super();
        this._reqRouter = findMyWay({
            ignoreTrailingSlash: true,
            ignoreDuplicateSlashes: true
        });
    }

    /*** public functions ***/
    build() {
        if (this._build) throw new Error('build() was already called');

        const allRoutes = this.collectRoutes();

        /* catch all the methods */
        this._allowedMethods = new Set(allRoutes.map(_ => _.method)).add('OPTIONS');

        /* create route for OPTIONS request */
        const optionsRoute: RouteCompiled = {
            fullPath: '*',
            method: 'OPTIONS',
            pipeline: [...this._stages],
            handler: optionsRequestRoute(Array.from(this._allowedMethods))
        }
        allRoutes.push(optionsRoute);

        /* create pipline and handler for route and register */
        for (const route of allRoutes) {
            this._reqRouter.on(route.method, route.fullPath, async (req, res, params) => {
                /* create context for this route */
                const ctx = this._createContext(req, res, params);

                /* start executing all stages & handler */
                try {
                    /* stages */
                    for (const stage of route.pipeline) {
                        const stageRes = await stage.handler(ctx);

                        if (stageRes) {
                            /* if stage returned something stop pipeline with response */
                            return this._sendResponse(res, stageRes);
                        }
                    }

                    /* main handler */
                    const mainRes = await route.handler.handler(ctx);

                    if (mainRes) {
                        /* create a valid OK response */
                        this._sendResponse(res, {
                            status: HTTPStatus.OK,
                            body: mainRes,
                            serializer: route.handler.serializer,
                            // headers: ?? TODO
                        });
                    }
                    else {
                        /* route is a no content response */
                        this._sendResponse(res, { status: HTTPStatus.NO_CONTENT })
                    }
                }
                catch (e) {
                    // TODO: handle errors
                    this._handleError(e, ctx);
                }
            });
        }

        /* dev. output TODO: */
        console.log(`Methods: ${Array.from(this._allowedMethods).join(',')}`);
        allRoutes.map((route) => {
            console.log(`[${route.method}] ${route.fullPath} - Stages: ${route.pipeline.length}`);
        })

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
    private _createContext(req: http.IncomingMessage, res: http.ServerResponse, params: Params): PipeContext {
        const ctx: PipeContext = {
            req,
            res,
            params,
            query: {}    // TODO: catch query params
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
    private _handleError(e: any, ctx: PipeContext) {
        try {
            if (e instanceof PipeError) {
                this._sendResponse(ctx.res, e.toPipeResponse());
            }
            else if (e instanceof Error) {
                const err = new DefaultPipeErr(e);
                this._sendResponse(ctx.res, err.toPipeResponse());
            }
            else {
                // TODO: create some error for unknown failuires
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
            if (this._notFoundHandler) {
                const res = await this._notFoundHandler.handler(ctx);
                //TODO: send response
            }
            else {
                /* create default not repsonse by throwing error*/
                throw new NotFoundPipeErr(req.method as HTTPMethod, req.url || '');
            }
        }
        catch (e) {
            // TODO: handle errors
            this._handleError(e, ctx);
        }
    }
}