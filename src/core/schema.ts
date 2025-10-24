/*** import ***/
import { stringyfy } from "./types";

/*** types for schemas ***/
export type DefaultPipeErrPayload = {
    name: string;
    message: string;
}
export type BadRequestPipeErrPayload = {    // TODO: enough
    message: string;
}

/*** schemas for errors ***/
// TODO: use fast-json-stringify for better performance
export const defaultPipeErrSerializer: stringyfy<DefaultPipeErrPayload> = (data) => {
    return JSON.stringify(data);
}
export const badRequestPipeErrSerializer: stringyfy<BadRequestPipeErrPayload> = (data) => {
    return JSON.stringify(data);
}