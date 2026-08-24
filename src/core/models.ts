/*** imports ***/
import { IncomingMessage, ServerResponse } from "http";
import { DataType, Infer, ObjectType, ParsedSchema } from "./datatypes";

/*** definitions ***/
export const PIPE_RESPONSE_BRAND = Symbol('PipeResponse');

/*** global ***/
export type MaybePromise<T> = T | Promise<T>;
export type StringIfDefined<T> = T extends undefined ? undefined : string;
/*** params ***/
type ExtractParamNames<Path extends string> =
    Path extends `${string}/:${infer Param}/${infer Rest}`
    ? Param | ExtractParamNames<`/${Rest}`>
    : Path extends `${string}/:${infer Param}`
    ? Param
    : never;
type StrictParamsSchema<Path extends string> = {
    [K in ExtractParamNames<Path>]: DataType<unknown, false>
};
type InferParams<Path extends string, Opts extends RouteOptions<Path>> =
    ExtractParamNames<Path> extends never
    ? Record<string, never>                                     // no params in path
    : Opts["params"] extends ObjectType<infer TSchema, boolean>
    ? ParsedSchema<TSchema>                                     // params definied with validation
    : { [K in ExtractParamNames<Path>]: string };               // raw params
type RouteParams<Path extends string> =
    [ExtractParamNames<Path>] extends [never]
    ? never
    : ObjectType<StrictParamsSchema<Path>, false>;

/*** state ***/
export type UnknownState = Record<string, unknown>;
type StageState<S> = S extends PipeStage<unknown, infer State> ? State : UnknownState;
type StateFromStages<T extends readonly PipeStage<any, any>[]> =
    T extends readonly [infer Head extends PipeStage<any, any>, ...infer Tail extends PipeStage<any, any>[]]
    ? StageState<Head> & StateFromStages<Tail>
    : UnknownState;
export type InferStateFromOpts<Opts> =
    Opts extends { stages: infer S extends readonly PipeStage<any, any>[] }
    ? StateFromStages<S>
    : UnknownState;
/*** router types ***/
export const HTTPMethod = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD"
] as const;
export type HTTPMethod = typeof HTTPMethod[number];
export type ParamsType = { [key: string]: string | undefined }
export type PipeContext<Path extends string, Opts extends RouteOptions<Path>> = {
    req: IncomingMessage;
    res: ServerResponse;
    params: InferParams<Path, Opts>;
    query: Infer<Opts["query"]>;
    body: Infer<Opts['body']>;
    files: InferFiles<Opts["files"]>;
    cookies: InferCookies<Opts["cookies"]>;
    rawCookies: Record<string, string>;
    rawBody: StringIfDefined<Opts["body"]>;
}
export type PipeResponse<Body = any> = {
    [PIPE_RESPONSE_BRAND]: true,
    status: HTTPStatus;
    body?: Body;
    headers?: Record<string, string>;
    cookies?: SetCookieEntry[];
    serializer?: stringyfy<Body>;
    contentType?: HTTPContentType;
    terminate?: boolean;
}
export type PipeStageHandler<Res, State = UnknownState> = (ctx: PipeContext<any, any>, state: State) => Promise<PipeResponse<Res> | void> | PipeResponse<Res> | void; // TODO: add missing types for ctx
export type PipeRouteHandler<Path extends string, Opts extends RouteOptions<Path>, State = UnknownState> = (ctx: PipeContext<Path, Opts>, state: State) => MaybePromise<InferResponseType<Opts> | PipeResponse<any>>;
export type PipeStage<Res, State = UnknownState> = {
    handler: PipeStageHandler<Res, State>;
    runBeforeParse?: boolean;
    serializer?: stringyfy<Res>;
}
export type Route<Path extends string> = {
    method: HTTPMethod;
    path: Path;
    handler: PipeRouteHandler<Path, any, any>;
    serializer: stringyfy<any>;
    stages?: PipeStage<any, any>[];
    body?: ObjectType;
    contentType?: HTTPContentType;
    files?: Record<string, FileOption>;
    params?: RouteParams<Path>;
    query?: ObjectType<any, boolean>;
    cookies?: ObjectType<any, boolean>;
    bodyLimit?: number;
}
export type RouteOptions<
    Path extends string,
    Stages extends readonly PipeStage<any, any>[] = PipeStage<any, any>[]
> = {
    params?: RouteParams<Path>,
    query?: ObjectType;
    body?: ObjectType;
    files?: Record<string, FileOption>;
    response?: ObjectType;
    stages?: Stages;
    contentType?: HTTPContentType;
    cookies?: ObjectType;
    bodyLimit?: number;
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
    // --- 1xx Informational ---
    CONTINUE: 100,
    SWITCHING_PROTOCOLS: 101,
    PROCESSING: 102,
    EARLY_HINTS: 103,

    // --- 2xx Success ---
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NON_AUTHORITATIVE_INFORMATION: 203,
    NO_CONTENT: 204,
    RESET_CONTENT: 205,
    PARTIAL_CONTENT: 206,
    MULTI_STATUS: 207,
    ALREADY_REPORTED: 208,
    IM_USED: 226,

    // --- 3xx Redirection ---
    MULTIPLE_CHOICES: 300,
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    SEE_OTHER: 303,
    NOT_MODIFIED: 304,
    USE_PROXY: 305,
    SWITCH_PROXY: 306,
    TEMPORARY_REDIRECT: 307,
    PERMANENT_REDIRECT: 308,

    // --- 4xx Client Error ---
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    PROXY_AUTHENTICATION_REQUIRED: 407,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    GONE: 410,
    LENGTH_REQUIRED: 411,
    PRECONDITION_FAILED: 412,
    CONTENT_TOO_LARGE: 413,
    URI_TOO_LONG: 414,
    UNSUPPORTED_MEDIA_TYPE: 415,
    RANGE_NOT_SATISFIABLE: 416,
    EXPECTATION_FAILED: 417,
    IM_A_TEAPOT: 418,
    MISDIRECTED_REQUEST: 421,
    UNPROCESSABLE_CONTENT: 422,
    LOCKED: 423,
    FAILED_DEPENDENCY: 424,
    TOO_EARLY: 425,
    UPGRADE_REQUIRED: 426,
    PRECONDITION_REQUIRED: 428,
    TOO_MANY_REQUESTS: 429,
    REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
    UNAVAILABLE_FOR_LEGAL_REASONS: 451,

    // --- 5xx Server Error ---
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
    HTTP_VERSION_NOT_SUPPORTED: 505,
    VARIANT_ALSO_NEGOTIATES: 506,
    INSUFFICIENT_STORAGE: 507,
    LOOP_DETECTED: 508,
    NOT_EXTENDED: 510,
    NETWORK_AUTHENTICATION_REQUIRED: 511
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
/*** cookie types ***/
export type InferCookies<T> =
    T extends ObjectType<any, any>
    ? Infer<T>
    : undefined;
export type CookieSameSite = 'Strict' | 'Lax' | 'None';
export type SetCookieOptions = {
    maxAge?: number;        // seconds
    expires?: Date;
    path?: string;          // default: '/'
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: CookieSameSite;
    partitioned?: boolean;  // CHIPS
}
export type SetCookieEntry = SetCookieOptions & {
    name: string;
    value: string;
}

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
/*** events ***/
export type PipePressEvents = {
    unlink_failed: [path: string, err: Error],
    unable_to_response: [err: Error],
    error: [err: Error],
    clientError: [err: Error]
}