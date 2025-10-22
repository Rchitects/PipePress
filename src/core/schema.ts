/*** import ***/
import { stringyfy } from "./types";

/*** types for schemas ***/
export type DefaultPipeErrPayload = {
    name: string;
    message: string;
}

/*** schemas for errors ***/
export const defaultPipeErrSerializer: stringyfy<DefaultPipeErrPayload> = (data) => {
    return JSON.stringify(data);
}