/*** imports ***/
import findMyWay, { HTTPVersion } from "find-my-way";
import * as http from "http";
import { Router } from "./router";
import { HTTPContentType, HTTPMethod, HTTPStatus, PipeContext, PipeResponse } from "./types";
import { DefaultPipeErr, PipeError } from "./error";

/*** class ***/
export class PipePress extends Router {
    /*** varbs ***/
    private _build = false;
    private _reqRouter: findMyWay.Instance<HTTPVersion.V1>
    private _server: http.Server | undefined;
    private _allowedMethods: HTTPMethod[] = []; //TODO: fill array and create OPTIONS stage

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
                this._reqRouter.lookup(req, res);
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
    private _createContext(req: http.IncomingMessage, res: http.ServerResponse, params: { [key: string]: string | undefined }): PipeContext {
        const ctx: PipeContext = {
            req,
            res,
            params,
            query: {}
        };
        return ctx;
    }
    private _sendResponse(res: http.ServerResponse, result: PipeResponse) {
        console.log(result);
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

            }
        }
        catch (e) {
            /* double failer -> make it clear for logging or somehting like this */
            console.log(e);
        }
    }
    // private async _runPipeline(req: http.IncomingMessage, res: http.ServerResponse, params: Record<string, string | undefined>, pipeline: Stage[]) {
    //     /* create context */
    //     const ctx: BaseCtx = {
    //         req: Object.assign(req, { params }),
    //         res: res
    //     };

    //     /* run the pipeline */
    //     try {
    //         for (const stage of pipeline) {
    //             const response = await stage(ctx);

    //             if (res.headersSent) return; /* current stage already send a response */

    //             if (response) {
    //                 // TODO: send response and stop pipeline
    //                 return response.send(res);
    //             }
    //         }
    //         /* if this point is reached no stage has send any response -> error */
    //         throw new InternalError('Route pipelining failed');
    //     }
    //     catch (e) {
    //         this._handleError(e, ctx);
    //     }
    // }

    // private _handleError(err: any, ctx: BaseCtx) {
    //     try {
    //         if (err instanceof PipeError) {
    //             const resp = new PipeResponse<string>(err.status, err.serialize());
    //             resp.send(ctx.res);
    //         }
    //         else {
    //             let pipeErr: PipeError<any>;
    //             if (err instanceof Error) {
    //                 pipeErr = new InternalError(err);
    //             }
    //             else {
    //                 pipeErr = new InternalError();
    //             }
    //             const resp = new PipeResponse(pipeErr.status, pipeErr.serialize());
    //             resp.send(ctx.res);
    //         }
    //     }
    //     catch (fatal) {
    //         /* even the the error handled failed -> try to close the response */
    //         if (!ctx.res.headersSent) {
    //             ctx.res.statusCode = HTTPStatus.INTERNAL_ERROR;
    //             ctx.res.setHeader('Content-Type', 'application/json');
    //             ctx.res.end(JSON.stringify({ error: 'Internal Server Error' }));
    //             // TODO: make it visible for DEBUGING
    //         }
    //         else {
    //             ctx.res.end();
    //         }
    //     }
    // }
}