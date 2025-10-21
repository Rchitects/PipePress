/*** imports ***/
import { IncomingMessage, ServerResponse } from "http";
import type { APIResponse } from "./response";

/**
 * router types
 */
export type RouterOptions = {
    prefix?: string;
}
export type HTTPMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "OPTIONS"
    | "HEAD";
export type BaseCtx<Body = any, Query = any, Params = any, Extra = {}> = {
    req: IncomingMessage & {
        body?: Body;
        query?: Query;
        params?: Params;
    };
    res: ServerResponse;
} & Extra;
export type ExtendedCtx<C, Extra> = C & Extra;
export type Stage<StCtx extends BaseCtx = BaseCtx> = (ctx: StCtx) => Promise<APIResponse | undefined> | APIResponse | undefined;
export type Route<RCtx extends BaseCtx = BaseCtx> = {
    method: HTTPMethod;
    path: string;
    handler: Stage<RCtx>;
    stages?: Stage<RCtx>[];
};

/**
 * PipePress types
 */
export type CompiledRoute<RCtx extends BaseCtx = BaseCtx> = {
    method: HTTPMethod;
    fullPath: string;
    pipeline: Stage<RCtx>[];
}