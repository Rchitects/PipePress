/*** imports ***/
import path from "path";
import { BadRequestPipeErr, ContentTooLargePipeErr, ValidationPipeErr } from "../core/error";
import { FileUpload, HTTPContentType, HTTPMethod, PipeContext, PipeStage, Route } from "../core/types";
import { fastUUID, isContentType } from "../core/utils";
import Busboy from "busboy";
import os from "node:os";
import { createWriteStream } from "node:fs";

/*** types ***/
type RequestParserOptions = {
    bodyLimit?: number
};

/*** definitions ***/
const DEFAULT_OPTS: Required<RequestParserOptions> = {
    bodyLimit: 0
}
const ALLOWED_BODY_METHODS: HTTPMethod[] = ['POST', 'PUT', 'PATCH'];

/*** functions ***/
async function parseMultiPartBody(ctx: PipeContext<any>, route: Route) {
    return new Promise<{ fields: Record<string, string>, files: Record<string, FileUpload[]> }>((resolve, reject) => {
        /* create busboy instance */
        const busbuy = Busboy({ headers: ctx.req.headers });

        /* storage for files & fields */
        const fields: Record<string, string> = {};
        const files: Record<string, FileUpload[]> = {};

        /* setup event handler */
        busbuy.on("file", (name, file, info) => {
            // TODO: check for max size
            // TODO: check for max amount
            /* check if file is allowed */
            if (route.files && !route.files[name]) {
                /* skip file */
                file.resume();
                return;
            }

            /* valid file, store it */
            const { filename, encoding, mimeType } = info;
            const filePath = path.join(os.tmpdir(), `${fastUUID()}_${filename}`);
            const writeStream = createWriteStream(filePath);

            let fileSize = 0;

            /* create result */
            const fileInfo: FileUpload = {
                filename: filename,
                encoding: encoding,
                size: 0,
                mimeType: mimeType,
                path: filePath
            };

            /* setup handler */
            file.on("data", (chunk: Buffer) => {
                fileSize += chunk.length;
            });

            file.on("end", () => {
                fileInfo.size = fileSize;
            });

            file.pipe(writeStream);

            /* save to result */
            if (!files[name]) files[name] = [];
            files[name].push(fileInfo);
        });

        busbuy.on("field", (name, value) => {
            fields[name] = value;
        });

        busbuy.on("error", (err) => {
            reject(err);
        });

        busbuy.on("finish", () => {
            resolve({
                fields,
                files
            });
        });

        /* start parsing */
        ctx.req.pipe(busbuy);
    });
}
function normalizeQuery(query: Record<string, string>): Record<string, string | boolean> {
    const res = {} as Record<string, string | boolean>;

    for (const key in query) {
        const val = query[key];

        if (Array.isArray(val)) {
            res[key] = val.pop();
        }
        else if (val === '') {
            res[key] = true;
        }
        else {
            res[key] = val;
        }
    }

    return res;
}

/*** body-parser stage ***/
export const parseAndValidateRequestStage = (route: Route, options: RequestParserOptions): PipeStage<any> => {
    const opts = { ...DEFAULT_OPTS, ...options };
    return {
        handler: async (ctx) => {
            /**
             * PARAMS
             */
            if (route.params) {
                /* parse and validate the parameter */
                try {
                    ctx.params = route.params.validate(ctx.params);
                }
                catch (e) {
                    if (e instanceof TypeError) {
                        throw new ValidationPipeErr(`Parameter validation failed: ${e.message}`);
                    }
                    throw new BadRequestPipeErr('Parameter validation failed (unknown failure)');
                }
            }
            /**
             * QUERY
             */
            if (ctx.query) {
                ctx.query = normalizeQuery(ctx.query);
            }
            if (route.query) {
                /* parse and validate the parameter */
                try {
                    ctx.query = route.query.validate(ctx.query);
                }
                catch (e) {
                    if (e instanceof TypeError) {
                        throw new ValidationPipeErr(`Query-parameter validation failed: ${e.message}`);
                    }
                    throw new BadRequestPipeErr('Query-parameter validation failed (unknown failure)');
                }
            }

            /**
             * BODY
             */
            const len = parseInt(ctx.req.headers['content-length'] || '0');
            const isBodyMethod = ALLOWED_BODY_METHODS.includes(ctx.req.method as HTTPMethod);

            /* stop if payload to big */
            if (opts.bodyLimit > 0 && len > opts.bodyLimit) {
                /* body to big */
                ctx.req.resume();   // TODO: give him hard cut-off with destroy?
                throw new ContentTooLargePipeErr(opts.bodyLimit, len);
            }

            /* ignore body if not needed */
            if (!isBodyMethod || (!route.body && !route.files)) {
                /* just ignore body to avoid backpressure */
                ctx.req.resume();
                return;
            }

            /* if body is already present, stop */
            if (ctx.body !== undefined) return;

            /* check what kind of content we have */
            const contentType = ctx.req.headers['content-type'] ?? '';
            let validateBody = true;

            if (isContentType(contentType, 'multipart/form-data')) {
                /* parse data via busboy */
                try {
                    const { fields, files } = await parseMultiPartBody(ctx, route);
                    ctx.files = files;  /* only files in ctx.files are considered */

                    if (route.body) {
                        ctx.body = fields;
                    }
                    else {
                        /* make sure body is not validated & undefined */
                        ctx.body = undefined;
                        validateBody = false;
                    }
                }
                catch (e) {
                    throw new BadRequestPipeErr('Could not parse multipart/form-data body.');
                }
            }
            else {
                /* normal content will be read buffered into RAM */
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

                try {
                    if (isContentType(contentType, 'application/json')) {
                        ctx.body = JSON.parse(rawData.toString('utf-8'));
                    }
                    else if (isContentType(contentType, 'application/x-www-form-urlencoded')) {
                        ctx.body = Object.fromEntries(new URLSearchParams(rawData.toString('utf-8')));
                    }
                    else {
                        validateBody = false;
                        ctx.body = rawData;
                    }
                }
                catch (e) {
                    throw new BadRequestPipeErr('Could not parse request body.');
                }
            }

            /* validate & transform body */
            if (route.files) {
                /* validate if required files are present */
                for (const fileGroup in route.files) {
                    const fileOption = route.files[fileGroup];
                    if (
                        fileOption.required &&
                        (!ctx.files || !ctx.files[fileGroup])
                    ) {
                        throw new ValidationPipeErr(`Missing required file ${fileGroup}`);
                    }
                }
            }
            if (route.body && validateBody) {
                try {
                    ctx.body = route.body.validate(ctx.body);
                }
                catch (e) {
                    if (e instanceof TypeError) {
                        throw new ValidationPipeErr(`Body validation failed: ${e.message}`);
                    }
                    throw new BadRequestPipeErr('Request body validation failed (unknown failure)');
                }
            }
        }
    };
}