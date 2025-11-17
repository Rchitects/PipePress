/*** import ***/
import { stringyfy } from "./types";
import dt from "./datatypes";

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
export const DefaultPipeErrSchema = dt.Object({
    message: dt.String(),
    name: dt.String()
});
export const BadRequestPipeErrSchema = dt.Object({
    message: dt.String()
});
export const NotFoundPipErrSchema = dt.Object({
    message: dt.String(),
    method: dt.String(),
    path: dt.String()
});