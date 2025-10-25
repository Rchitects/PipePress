/*** import ***/
import { stringyfy } from "./types";

/*** types for schemas ***/
type PipeErrPayload<T> = {
    message: string;
} & T;
export type DefaultPipeErrPayload = PipeErrPayload<{
    name: string;
}>;
export type BadRequestPipeErrPayload = PipeErrPayload<{}>;  // TODO: enough?
export type NotFoundPipErrPayload = PipeErrPayload<{
    method: string;
    path: string;
}>;

/*** schemas for errors ***/
// TODO: use fast-json-stringify for better performance
export const defaultPipeErrSerializer: stringyfy<DefaultPipeErrPayload> = (data) => {
    return JSON.stringify(data);
}
export const badRequestPipeErrSerializer: stringyfy<BadRequestPipeErrPayload> = (data) => {
    return JSON.stringify(data);
}
export const notFoundPipeErrSerializer: stringyfy<NotFoundPipErrPayload> = (data) => {
    return JSON.stringify(data);
}