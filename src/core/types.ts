/*** imports ***/
import { IncomingMessage, ServerResponse } from "http";
import { ParsedType, ValidatorType } from "./validation";

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
    serializer?: stringyfy<Body>;    // TODO: use fast-json
}
export type PipeStageHandler<Body, Params> = (ctx: PipeContext<any>) => Promise<PipeResponse<Body> | void> | PipeResponse<Body> | void;
export type PipeRouteHandler<B = undefined, P = undefined, Q = undefined> = (ctx: PipeContext<B, P, Q>) => MaybePromise<any>; // TODO: include response
export type PipeStage<Res> = {
    handler: PipeStageHandler<Res, any>;
    serializer?: stringyfy<Res>;    // TODO: use fast-json
}
export type Route = {
    method: HTTPMethod;
    path: string;
    handler: PipeRouteHandler<any, any, any>;
    stages?: PipeStage<any>[];
    body?: ValidatorType<any, boolean>;
    serializer?: stringyfy<any>;    // TODO: use fast-json
}
export type RouteInput = {
    body?: ValidatorType<any, boolean>,
    params?: Params;
    query?: any;
};
export type RouteOptions<B extends ValidatorType<any, boolean> | undefined> = {
    stages?: PipeStage<any>[];
    body?: B;
    serializer?: stringyfy<any>;    // TODO: use fast-json
}
export type HandlerInput = {
    body?: ValidatorType<any, boolean>
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
    // server error
    INTERNAL_ERROR: 500
} as const;
export type HTTPStatus = typeof HTTPStatus[keyof typeof HTTPStatus];
export type HTTPContentType =
    | 'application/json'
    | 'text/plain'
    | 'application/x-www-form-urlencoded';
export type stringyfy<T> = (data: T) => string;

/*** pipepress types ***/
export type PipeRouterConfig = {
    maxBodyLength?: number;
}
export type PipePressConfig = PipeRouterConfig