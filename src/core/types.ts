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
export type ParamsType = { [key: string]: string | undefined }
export type PipeContext<Params, Query, Opts extends RouteOptions> = {
    req: IncomingMessage;
    res: ServerResponse;
    params: Params;
    query: Query;
    body: ParsedType<Opts['body']>;
    files: InferFiles<Opts["files"]>;
    [key: string]: any; // TODO?
}
export type PipeResponse<Body = any> = {
    status: HTTPStatus;
    body?: Body;
    headers?: Record<string, string>;
    serializer?: stringyfy<Body>;
    contentType?: HTTPContentType;
}
export type PipeStageHandler<Body> = (ctx: PipeContext<any, any, any>) => Promise<PipeResponse<Body> | void> | PipeResponse<Body> | void; // TODO: add missing types for ctx
export type PipeRouteHandler<Params, Query, Res, Opts extends RouteOptions<any, any, any>> = (ctx: PipeContext<Params, Query, Opts>) => MaybePromise<Res>; // TODO: match Res with Opts['response']
export type PipeStage<Res> = {
    handler: PipeStageHandler<Res>;
    serializer?: stringyfy<Res>;
}
export type Route = {
    method: HTTPMethod;
    path: string;
    handler: PipeRouteHandler<any, any, any, any>;
    serializer: stringyfy<any>;
    stages?: PipeStage<any>[];
    body?: DataType<any, boolean>;
    contentType?: HTTPContentType;
    files?: Record<string, true>;
}
export type RouteOptions<
    Res = void,
    Body extends DataType<any, boolean> | undefined = undefined,
    Files extends Record<string, true> | undefined = undefined
> = {
    stages?: PipeStage<any>[];
    body?: Body;
    response?: DataType<Res, boolean>;
    contentType?: HTTPContentType;
    files?: Files;
}
export type FileUpload = {
    field: string;
    filename: string;
    data: Buffer;
    contentType?: string;
}
export type InferFiles<T> = T extends Record<string, true> ? { [K in keyof T]: FileUpload[] } : Record<string, FileUpload[]>;

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
    | 'multipart/form-data'
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