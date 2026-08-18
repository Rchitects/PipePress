/*** imports ***/
import { HTTPMethod, HTTPStatus, PipeResponse, stringyfy } from "./models";
import { DataType } from "./datatypes";
import fastJSON from "fast-json-stringify";
import dt from "./datatypes";
import { pipeResponse } from "./utils";

/*** types for schemas ***/
type PipeErrPayload = {
    message: string;
};
type DefaultPipeErrPayload = PipeErrPayload & {
    errName: string;
};
type BadRequestPipeErrPayload = PipeErrPayload;  // TODO: enough?
type NotFoundPipErrPayload = PipeErrPayload & {
    method: HTTPMethod;
    path: string;
};
type ContentTooLargePipeErrPayload = PipeErrPayload & {
    allowed: number;
    sent: number;
};
type TooManyReqeuestsPipeErrPayload = PipeErrPayload & {
    retryAfterMs: number;
    reqeustLimit: number;
    requestCount: number;
};

/*** schemas for errors ***/
const PipeErrSchema = dt.Object({
    message: dt.String()
});
const DefaultPipeErrSchema = dt.Object({
    message: dt.String(),
    errName: dt.String()
});
const BadRequestPipeErrSchema = dt.Object({
    message: dt.String()
});
const NotFoundPipErrSchema = dt.Object({
    message: dt.String(),
    method: dt.StringLiteral(...HTTPMethod),
    path: dt.String()
});
const ContentTooLargePipeErrSchema = dt.Object({
    message: dt.String(),
    allowed: dt.Number(),
    sent: dt.Number()
});
const TooManyReqeuestsPipeErrSchema = dt.Object({
    message: dt.String(),
    retryAfterMs: dt.Number(),
    reqeustLimit: dt.Number(),
    requestCount: dt.Number()
});

/*** main class ***/
// TODO: unforce user to use message in any error?
export abstract class PipeError<T extends PipeErrPayload> extends Error {
    status: HTTPStatus;
    terminate: boolean = false;
    protected payload: T;
    #serializer?: stringyfy<T>;

    constructor(name: string, status: HTTPStatus, payload: T, terminate?: boolean, schema?: DataType<T, boolean>) {
        super(payload.message);
        this.status = status;
        this.name = name;
        this.payload = payload;
        /* create serializer */
        if (schema) {
            this.#serializer = fastJSON(schema.toJSONSchema() as any);
        }
        if (terminate !== undefined) {
            this.terminate = terminate;
        }
    }

    /*** public function ***/
    public toPipeResponse(): PipeResponse<T> {
        return pipeResponse({
            status: this.status,
            body: this.payload,
            serializer: this.#serializer,
            terminate: this.terminate
        });
    }
}
/*** pre-defiened errors ***/
export class InternalPipeErr extends PipeError<DefaultPipeErrPayload> {
    constructor(err: Error) {
        super(err.name, HTTPStatus.INTERNAL_SERVER_ERROR, { message: err.message, errName: err.name }, false, DefaultPipeErrSchema);
    }
}
export class BadRequestPipeErr extends PipeError<BadRequestPipeErrPayload> {
    constructor(message: string) {
        super('BadRequestPipeErr', HTTPStatus.BAD_REQUEST, { message }, false, BadRequestPipeErrSchema);
    }
}
export class RouteNotFoundPipeErr extends PipeError<NotFoundPipErrPayload> {
    constructor(method: HTTPMethod, path: string, message: string = 'URL not found') {
        super('RouteNotFoundPipeErr', HTTPStatus.NOT_FOUND, { message, method, path }, false, NotFoundPipErrSchema);
    }
}
export class ValidationPipeErr extends PipeError<BadRequestPipeErrPayload> {
    constructor(message: string) {
        super('ValidationPipeErr', HTTPStatus.BAD_REQUEST, { message }, false, BadRequestPipeErrSchema)
    }
}
export class ContentTooLargePipeErr extends PipeError<ContentTooLargePipeErrPayload> {
    constructor(allowed: number, sent: number) {
        super('ContentTooLargePipeErr', HTTPStatus.CONTENT_TOO_LARGE, { message: 'Payload is too large', allowed, sent }, true, ContentTooLargePipeErrSchema);
    }
}
export class TooManyRequestsPipeErr extends PipeError<TooManyReqeuestsPipeErrPayload> {
    constructor(retryAfterMs: number, reqeustLimit: number, requestCount: number) {
        super('TooManyRequestsPipeErr', HTTPStatus.TOO_MANY_REQUESTS, { message: 'Too many requests', reqeustLimit, requestCount, retryAfterMs }, true, TooManyReqeuestsPipeErrSchema);
    }
}
export class UnauthorizedPipeErr extends PipeError<PipeErrPayload> {
    constructor(message: string) {
        super('UnauthorizedPipeErr', HTTPStatus.UNAUTHORIZED, { message }, false, PipeErrSchema);
    }
}
export class ForbiddenPipeErr extends PipeError<PipeErrPayload> {
    constructor(message: string) {
        super('ForbiddenPipeErr', HTTPStatus.FORBIDDEN, { message }, false, PipeErrSchema);
    }
}