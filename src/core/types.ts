/*** imports ***/
import { IncomingMessage, ServerResponse } from "http";

/**
 * router types
 */
export type HTTPMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "OPTIONS"
    | "HEAD";

export type PipeContext = {
    req: IncomingMessage;
    res: ServerResponse;
    params: Record<string, string | undefined>;
    query: Record<string, string>;
    body?: any;
    [key: string]: any;
}
export type PipeResponse<Body = any> = {
    status: HTTPStatus;
    body?: Body;
    headers?: Record<string, string>;
    serializer?: stringyfy<Body>;    // TODO: use fast-json
}
export type PipeStageHandler<Body> = (ctx: PipeContext) => Promise<PipeResponse<Body> | void> | PipeResponse<Body> | void;
export type PipeRouteHandler<Res> = (ctx: PipeContext) => Promise<Res | void> | Res | void;
export type PipeStage<Res> = {
    handler: PipeStageHandler<Res>;
    serializer?: stringyfy<Res>;    // TODO: use fast-json
}
export type PipeRoute<Res> = {
    handler: PipeRouteHandler<Res>;
    serializer?: stringyfy<Res>;    // TODO: use fast-json
}
export type Route = {
    method: HTTPMethod;
    path: string;
    handler: PipeRoute<any>;
    stages?: PipeStage<any>[];
}
export type RouteCompiled = {
    method: HTTPMethod;
    fullPath: string;
    pipeline: PipeStage<any>[];
    handler: PipeRoute<any>;
}
/**
 * PipeResponse types
 */
export enum HTTPStatus {
    // success
    OK = 200,
    CREATED = 201,
    NO_CONTENT = 204,
    // client error
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    // server error
    INTERNAL_ERROR = 500
}
export type HTTPContentType =
    | 'application/json'
    | 'text/plain';
export type stringyfy<T> = (data: T) => string;