/*** imports ***/
import { BadRequestPipeErr } from "../core/error";
import { HTTPContentType, HTTPMethod, PipeStage } from "../core/types";
import { isContentType } from "../core/utils";

/*** types ***/
type BodyParserOptions = {
    json?: boolean;
    urlEncoded?: boolean;
    isoDate?: boolean
    // limit: number; // TODO: needed?
};

/*** definitions ***/
const DEFAULT_OPTS: Required<BodyParserOptions> = {
    json: true,
    urlEncoded: true,
    isoDate: false
}

/*** functions ***/
function isIsoDate(str: any): boolean {
    if (str === null || str === undefined) return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(str);
}
function parseISODate(obj: any): any {
    if (obj == null || typeof obj !== 'object') return obj;

    for (const key of Object.keys(obj)) {
        const value = obj[key];

        if (typeof value === 'string' && isIsoDate(value)) {
            obj[key] = new Date(value);
        }
        else if (typeof value === 'object') {
            parseISODate(value); // recursion for nested objects
        }
    }
    return obj;
}


/*** body-parser stage ***/
export const pipeBodyParser = (options: BodyParserOptions = {}): PipeStage<any> => {
    const opts = { ...DEFAULT_OPTS, ...options };
    const noneBodyMehtods: HTTPMethod[] = ['GET', 'HEAD', 'OPTIONS'];
    return {
        handler: async (ctx) => {
            if (ctx.body !== undefined) return;  /* body got fetched / parsed already */
            if (!ctx.req.method || noneBodyMehtods.includes(ctx.req.method as HTTPMethod)) return;

            /* get data */
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

            try {
                if (opts.json && isContentType(contentType, 'application/json')) {
                    ctx.body = JSON.parse(rawData.toString('utf-8'));
                    if (opts.isoDate) {
                        parseISODate(ctx.body);
                    }
                }
                else if (opts.urlEncoded && isContentType(contentType, 'application/x-www-form-urlencoded')) {
                    ctx.body = Object.fromEntries(new URLSearchParams(rawData.toString('utf-8')));
                    if (opts.isoDate) {
                        parseISODate(ctx.body);
                    }
                }
                else {
                    ctx.body = rawData;
                }
            }
            catch (e) {
                throw new BadRequestPipeErr('Could not parse request body.');
            }
        }
    };
}