/*** imports ***/
import { IncomingMessage, ServerResponse } from "http";

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
export type PipeContext = {
    req: IncomingMessage;
    res: ServerResponse;
    params: Params;
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
export type Route = {
    method: HTTPMethod;
    path: string;
    handler: PipeRouteHandler<any>;
    stages?: PipeStage<any>[];
    body?: any;
    serializer?: stringyfy<any>;    // TODO: use fast-json
}
export type RouteOptions = Pick<Route, 'stages' | 'body' | 'serializer'>;

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