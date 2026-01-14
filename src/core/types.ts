/*** imports ***/
import { IncomingMessage, ServerResponse } from "http";
import { ParsedType, DataType } from "./datatypes";

/*** global ***/
export type MaybePromise<T> = T | Promise<T>;
/*** router types ***/
export type HTTPMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "OPTIONS"
    | "HEAD";
export type Params = { [key: string]: string | undefined }
export type PipeContext<B = undefined, P = undefined, Q = undefined> = {
    req: IncomingMessage;
    res: ServerResponse;
    params: P
    query: Q
    body: ParsedType<B>;
    [key: string]: any;
}
export type PipeResponse<Body = any> = {
    status: HTTPStatus;
    body?: Body;
    headers?: Record<string, string>;
    serializer?: stringyfy<Body>;
    contentType?: HTTPContentType;
}
export type PipeStageHandler<Body> = (ctx: PipeContext<any>) => Promise<PipeResponse<Body> | void> | PipeResponse<Body> | void; // TODO: add missing types for ctx
export type PipeRouteHandler<Res = any, B = undefined, P = undefined, Q = undefined> = (ctx: PipeContext<B, P, Q>) => MaybePromise<Res>;
export type PipeStage<Res> = {
    handler: PipeStageHandler<Res>;
    serializer?: stringyfy<Res>;
}
export type Route = {
    method: HTTPMethod;
    path: string;
    handler: PipeRouteHandler<any, any, any>;
    serializer: stringyfy<any>;
    stages?: PipeStage<any>[];
    body?: DataType<any, boolean>;
    contentType?: HTTPContentType;
}
export type RouteOptions<Res, B extends DataType<any, boolean> | undefined> = {
    stages?: PipeStage<any>[];
    body?: B;
    response?: DataType<Res, boolean>;
    contentType?: HTTPContentType;
}

/*** reponse types ***/
export const HTTPStatus = {
    // success
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    // client error
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONTENT_TOO_LARGE: 413,
    TOO_MANY_REQUESTS: 429,
    // server error
    INTERNAL_ERROR: 500
} as const;
export type HTTPStatus = typeof HTTPStatus[keyof typeof HTTPStatus];
export type HTTPContentType =
    | 'application/json'
    | 'text/plain'
    | 'application/x-www-form-urlencoded'
    | 'image/gif'
    | 'image/jpeg'
    | 'image/png';
export type stringyfy<T> = (data: T) => string;

/*** pipepress types ***/
export type PipeRouterConfig = {
    maxBodyLength?: number;
}
export type PipeCORSConfig = {
    preflight?: 'auto' | 'off';
}
export type PipePressConfig = PipeRouterConfig & {
    cors?: PipeCORSConfig
}
export type PipePressInjectOptions = {
    method: HTTPMethod;
    url: string;
    headers?: Record<string, string>;
    body?: any;
}
export type PipePressInjectResponse = {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    json: <T = any>() => T;
    text: () => string;
    raw: () => Buffer;
}