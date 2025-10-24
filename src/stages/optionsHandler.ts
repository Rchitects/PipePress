/*** imports ***/
import { HTTPMethod, PipeRoute } from "../core/types";

/*** types ***/

/*** route handler ***/
export const optionsRequestRoute = (methods: HTTPMethod[]): PipeRoute<void> => {
    return {
        handler: async (ctx) => {
            ctx.res.setHeader('Allow', methods.join(', '));
        }
    }
}