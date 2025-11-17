/*** imports ***/
import { HTTPMethod } from "find-my-way";
import { BadRequestPipeErrPayload, BadRequestPipeErrSchema, DefaultPipeErrPayload, DefaultPipeErrSchema, NotFoundPipErrPayload, NotFoundPipErrSchema } from "./schema";
import { HTTPStatus, PipeResponse, stringyfy } from "./types";
import { DataType } from "./datatypes";
import fastJSON from "fast-json-stringify";

/*** main class ***/
export abstract class PipeError<T extends Record<string, string>> extends Error {
    private _serializer?: stringyfy<T>;
    constructor(name: string, message: string, public status: HTTPStatus, public response?: DataType<T, boolean>) {
        super(message);
        this.name = name;

        /* create serializer */
        if (response) {
            this._serializer = fastJSON(response.toJSONSchema() as any);
        }

        /* Fix für Error-Vererbung */
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /*** public function ***/
    protected abstract getPayload(): T | undefined;
    public toPipeResponse(): PipeResponse<T> {
        const body = this.getPayload();
        return {
            status: this.status,
            body: body,
            serializer: this._serializer
        };
    }
}
/*** pre-defiened errors ***/
export class DefaultPipeErr extends PipeError<DefaultPipeErrPayload> {
    constructor(err: Error) {
        super(err.name, err.message, HTTPStatus.INTERNAL_ERROR, DefaultPipeErrSchema)
    }
    protected getPayload(): DefaultPipeErrPayload {
        return {
            message: this.message,
            name: this.name
        };
    }
}
export class BadRequestPipeErr extends PipeError<BadRequestPipeErrPayload> {
    constructor(message: string) {
        super('BadRequestPipeErr', message, HTTPStatus.BAD_REQUEST, BadRequestPipeErrSchema);
    }
    protected getPayload(): BadRequestPipeErrPayload {
        return {
            message: this.message
        }
    }

}
export class NotFoundPipeErr extends PipeError<NotFoundPipErrPayload> {
    protected getPayload(): NotFoundPipErrPayload | undefined {
        return {
            message: this.message,
            method: this.method,
            path: this.path
        }
    }
    constructor(public method: HTTPMethod, public path: string, message: string = 'URL not found') {
        super('NotFoundPipeErr', message, HTTPStatus.NOT_FOUND, NotFoundPipErrSchema);
    }
}
export class ValidationPipeErr extends PipeError<BadRequestPipeErrPayload> {    // TODO: create own schema with more informations
    constructor(message: string) {
        super('ValidationPipeErr', message, HTTPStatus.BAD_REQUEST, BadRequestPipeErrSchema)
    }
    protected getPayload(): BadRequestPipeErrPayload | undefined {
        return {
            message: this.message
        }
    }
}