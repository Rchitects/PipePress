/*** imports ***/
import { DefaultPipeErrPayload, defaultPipeErrSerializer } from "./schema";
import { HTTPStatus, PipeResponse, stringyfy } from "./types";

/*** main class ***/
export abstract class PipeError<T extends Record<string, string>> extends Error {
    constructor(name: string, message: string, public status: HTTPStatus, public serializer?: stringyfy<T>) {
        super(message);
        this.name = name;

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
            serializer: this.serializer
        };
    }
}
/*** pre-defiened errors ***/
export class DefaultPipeErr extends PipeError<DefaultPipeErrPayload> {
    constructor(err: Error) {
        super(err.name, err.message, HTTPStatus.INTERNAL_ERROR, defaultPipeErrSerializer)
    }
    protected getPayload(): DefaultPipeErrPayload | undefined {
        return {
            message: this.message,
            name: this.name
        };
    }
}