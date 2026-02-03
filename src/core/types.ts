/*** imports ***/
import { IncomingMessage, ServerResponse } from "http";
import { ParsedType, DataType, ObjectType, SchemaDefinition } from "./datatypes";

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
export type PipeContext<Opts extends RouteOptions> = {
    req: IncomingMessage;
    res: ServerResponse;
    params: ParsedType<Opts["params"]>;
    query: ParsedType<Opts["query"]>;
    body: ParsedType<Opts['body']>;
    files: InferFiles<Opts["files"]>;
}
export type PipeResponse<Body = any> = {
    status: HTTPStatus;
    body?: Body;
    headers?: Record<string, string>;
    serializer?: stringyfy<Body>;
    contentType?: HTTPContentType;
}
export type PipeStageHandler<Res, State = {}> = (ctx: PipeContext<any>, state: State) => Promise<PipeResponse<Res> | void> | PipeResponse<Res> | void; // TODO: add missing types for ctx
export type PipeRouteHandler<Opts extends RouteOptions, State = {}> = (ctx: PipeContext<Opts>, state: State) => MaybePromise<InferResponseType<Opts>>;
export type PipeStage<Res, State = {}> = {
    handler: PipeStageHandler<Res, State>;
    serializer?: stringyfy<Res>;
}
export type Route = {
    method: HTTPMethod;
    path: string;
    handler: PipeRouteHandler<any, any>;
    serializer: stringyfy<any>;
    stages?: PipeStage<any, any>[];
    body?: DataType<any, boolean>;
    contentType?: HTTPContentType;
    files?: Record<string, FileOption>;
    params?: ObjectType<SchemaDefinition<false>, false>;
    query?: ObjectType<any, boolean>;
}
export type RouteOptions = {
    params?: ObjectType<SchemaDefinition<false>, false>;
    query?: ObjectType<any, boolean>;
    body?: DataType<any, boolean>;
    files?: Record<string, FileOption>;
    response?: DataType<any, boolean>;
    stages?: PipeStage<any, any>[];
    contentType?: HTTPContentType;
};


export type FileUpload = {
    filename: string;
    path: string;
    encoding: string;
    mimeType: string;
    size: number;
}
export type FileOption = {
    required: boolean;
    maxSize?: number;   // TODO: use it
    masAmount?: number;  // TODO: use it
}
export type InferFiles<T> =
    T extends undefined
    ? undefined
    : { [k in keyof T]: T[k] extends { required: true } ? FileUpload[] : FileUpload[] | undefined };
export type InferResponseType<Opts> =
    Opts extends { response: DataType<infer R, any> }
    ? R
    : any;

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