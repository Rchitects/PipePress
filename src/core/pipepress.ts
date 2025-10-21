/*** imports ***/
import * as http from "http";
import { Router } from "./router"
import findMyWay, { HTTPVersion } from "find-my-way"
import { BaseCtx, Stage } from "./types";

/*** class ***/
export class PipePress extends Router {
    /*** varbs ***/
    private _build = false;
    private _reqRouter: findMyWay.Instance<HTTPVersion.V1>
    private _server: http.Server | undefined;

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
            const pipeline = [...(route.stages ?? []), route.handler];
            this._reqRouter.on(route.method, route.path, async (req, res, params) => {
                await this._runPipeline(req, res, params, pipeline);
            });
        }

        /* dev. output TODO: */
        allRoutes.map((route) => {
            console.log(`[${route.method}] ${route.path} - Stages: ${route.stages?.length} - Handler: ${route.handler.name ?? '<anonymous>'}`);
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
    private async _runPipeline(req: http.IncomingMessage, res: http.ServerResponse, params: Record<string, string | undefined>, pipeline: Stage[]) {
        /* create context */
        const ctx: BaseCtx = {
            req: Object.assign(req, { params }),
            res: res
        };

        /* run the pipeline */
        try {
            for (const stage of pipeline) {
                const response = await stage(ctx);
                if (response) {
                    // TODO: send response and stop pipeline
                    return;
                }
                else if (res.headersSent) {
                    /* stage already completed the response */
                    return;
                }
            }
            /* if this point is reached no stage has send any response -> error */
            // TODO: throw error
            ctx.res.statusCode = 500;
            ctx.res.end('Endpoint is not implemented');
        }
        catch (e) {
            // TODO: catch API error
            // TODO: catch other errors
        }
    }
}