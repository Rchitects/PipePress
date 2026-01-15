/*** imports ***/
import { HTTPMethod } from "find-my-way";
import { HTTPStatus, PipeResponse, stringyfy } from "./types";
import { DataType } from "./datatypes";
import fastJSON from "fast-json-stringify";
import dt from "./datatypes";

/*** types for schemas ***/
type PipeErrBasePayload = {
    message: string;
};
type DefaultPipeErrPayload = PipeErrBasePayload & {
    errName: string;
};
type BadRequestPipeErrPayload = PipeErrBasePayload;  // TODO: enough?
type NotFoundPipErrPayload = PipeErrBasePayload & {
    method: string;
    path: string;
};
type ContentTooLargePipeErrPayload = PipeErrBasePayload & {
    allowed: number;
    sent: number;
};
type TooManyReqeuestsPipeErrPayload = PipeErrBasePayload & {
    retryAfterMs: number;
    reqeustLimit: number;
    requestCount: number;
};

/*** schemas for errors ***/
const BasePipeErrSchema = dt.Object({
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
    method: dt.String(),
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
export abstract class PipeError<T extends PipeErrBasePayload> {
    private _serializer?: stringyfy<T>;
    static readonly exludedKeys: string[] = ['name', 'status', 'response', '_serializer'];
    constructor(
        public name: string,
        public message: string,
        public status: HTTPStatus,
        public response?: DataType<T, boolean>
    ) {
        /* create serializer */
        if (response) {
            this._serializer = fastJSON(response.toJSONSchema() as any);
        }
    }

    /*** public function ***/
    public toPipeResponse(): PipeResponse<T> {
        /* generate body */
        let clone: T = <T>{};
        Object.assign(clone, this);
        // remove unneeded / undefined properties
        for (const key in clone) {
            if (clone[key] === undefined) {
                delete clone[key];
            }
            else if (PipeError.exludedKeys.includes(key)) {
                delete clone[key];
            }
        }

        /* return response */
        return {
            status: this.status,
            body: clone,
            serializer: this._serializer
        };
    }
}
/*** pre-defiened errors ***/
export class DefaultPipeErr extends PipeError<DefaultPipeErrPayload> {
    public errName: string;
    constructor(err: Error) {
        super(err.name, err.message, HTTPStatus.INTERNAL_ERROR, DefaultPipeErrSchema);
        this.errName = err.name;
    }
}
export class BadRequestPipeErr extends PipeError<BadRequestPipeErrPayload> {
    constructor(message: string) {
        super('BadRequestPipeErr', message, HTTPStatus.BAD_REQUEST, BadRequestPipeErrSchema);
    }
}
export class NotFoundPipeErr extends PipeError<NotFoundPipErrPayload> {
    constructor(public method: HTTPMethod, public path: string, message: string = 'URL not found') {
        super('NotFoundPipeErr', message, HTTPStatus.NOT_FOUND, NotFoundPipErrSchema);
    }
}
export class ValidationPipeErr extends PipeError<BadRequestPipeErrPayload> {
    constructor(message: string) {
        super('ValidationPipeErr', message, HTTPStatus.BAD_REQUEST, BadRequestPipeErrSchema)
    }
}
export class ContentTooLargePipeErr extends PipeError<ContentTooLargePipeErrPayload> {
    constructor(public allowed: number, public sent: number) {
        super('ContentTooLargePipeErr', `Payload is too large`, HTTPStatus.CONTENT_TOO_LARGE, ContentTooLargePipeErrSchema);
    }
}
export class TooManyRequestsPipeErr extends PipeError<TooManyReqeuestsPipeErrPayload> {
    constructor(public retryAfterMs: number, public reqeustLimit: number, public requestCount: number) {
        super('TooManyRequestsPipeErr', `Too many requests`, HTTPStatus.TOO_MANY_REQUESTS, TooManyReqeuestsPipeErrSchema);
    }
}
export class UnauthorizedPipeErr extends PipeError<PipeErrBasePayload> {
    constructor(message: string) {
        super('UnauthorizedPipeErr', message, HTTPStatus.UNAUTHORIZED, BasePipeErrSchema);
    }
}
export class ForbiddenPipeErr extends PipeError<PipeErrBasePayload> {
    constructor(message: string) {
        super('ForbiddenPipeErr', message, HTTPStatus.FORBIDDEN, BasePipeErrSchema);
    }
}