/*** imports ***/
import { BadRequestPipeErr, ContentTooLargePipeErr, ValidationPipeErr } from "../core/error";
import { HTTPContentType, HTTPMethod, PipeContext, PipeStage, Route } from "../core/types";
import { isContentType } from "../core/utils";

/*** types ***/
type BodyParserOptions = {
    limit?: number
};

/*** definitions ***/
const DEFAULT_OPTS: Required<BodyParserOptions> = {
    limit: 0
}
const ALLOWED_BODY_METHODS: HTTPMethod[] = ['POST', 'PUT', 'PATCH'];

/*** body-parser stage ***/
export const parseAndValidateBodyStage = (route: Route, options: BodyParserOptions): PipeStage<any> => {
    const opts = { ...DEFAULT_OPTS, ...options };
    return {
        handler: async (ctx) => {
            const len = parseInt(ctx.req.headers['content-length'] || '0');
            const isBodyMethod = ALLOWED_BODY_METHODS.includes(ctx.req.method as HTTPMethod);

            /* stop if payload to big */
            if (opts.limit > 0 && len > opts.limit) {
                /* body to big */
                ctx.req.resume();   // TODO: give him hard cut-off with destroy?
                throw new ContentTooLargePipeErr(opts.limit, len);
            }

            /* ignore body if not needed */
            if (!route.body || !isBodyMethod) {
                /* just ignore body to avoid backpressure */
                ctx.req.resume();
                return;
            }

            /* if body is already present, stop */
            if (ctx.body !== undefined) return;

            /* get data from stream */
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of ctx.req as AsyncIterable<Buffer>) {
                size += chunk.length;
                chunks.push(chunk);
            }
            if (!size) {
                ctx.body = undefined;
                return;
            }

            /* parse data */
            const rawData = Buffer.concat(chunks);
            const contentType: HTTPContentType = ctx.req.headers['content-type'] as HTTPContentType;
            let validate = true;
            try {
                if (isContentType(contentType, 'application/json')) {
                    ctx.body = JSON.parse(rawData.toString('utf-8'));
                }
                else if (isContentType(contentType, 'application/x-www-form-urlencoded')) {
                    ctx.body = Object.fromEntries(new URLSearchParams(rawData.toString('utf-8')));
                }
                else {
                    validate = false;
                    ctx.body = rawData;
                }
            }
            catch (e) {
                throw new BadRequestPipeErr('Could not parse request body.');
            }

            /* validate & transform body */
            if (route.body && validate) {
                try {
                    ctx.body = route.body.validate(ctx.body);
                }
                catch (e) {
                    if (e instanceof TypeError) {
                        throw new ValidationPipeErr(e.message);
                    }
                    throw new BadRequestPipeErr('Request body validation failed (unknown failure)');
                }
            }
        }
    };
}