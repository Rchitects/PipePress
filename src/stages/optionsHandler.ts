/*** imports ***/
import { HTTPMethod, PipeRouteHandler } from "../core/types";

/*** route handler ***/
export const optionsRequestRoute = (methods: HTTPMethod[]): PipeRouteHandler<void> => {
    return async (ctx) => {
        ctx.res.setHeader('Allow', methods.join(', '));
    }
}