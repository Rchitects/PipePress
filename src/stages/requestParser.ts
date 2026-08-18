/*** imports ***/
import Busboy from "busboy";
import { createWriteStream } from "node:fs";
import os from "node:os";
import Stream from "node:stream";
import path from "path";
import { BadRequestPipeErr, ContentTooLargePipeErr, InternalPipeErr, PipeError, ValidationPipeErr } from "../core/error";
import { FileUpload, HTTPMethod, PipeContext, PipeStage, Route } from "../core/models";
import { fastUUID, isContentType } from "../core/utils";

/*** types ***/
type RequestParserOptions = {
    bodyLimit?: number
};

/*** definitions ***/
export const BODY_LIMIT_DEFAULT = 1024 * 1024;  // 1MB
const DEFAULT_OPTS: Required<RequestParserOptions> = {
    bodyLimit: BODY_LIMIT_DEFAULT
}
const ALLOWED_BODY_METHODS: HTTPMethod[] = ['POST', 'PUT', 'PATCH'];

/*** guard class */
class ByteLimitGuard extends Stream.Transform {
    #received: number = 0;
    #limit: number;

    constructor(bytesLimit: number) {
        super();
        this.#limit = bytesLimit;
    }

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: Stream.TransformCallback): void {
        this.#received += chunk.length;

        if (this.#received > this.#limit) {
            callback(new ContentTooLargePipeErr(this.#limit, this.#received));
            return;
        }

        callback(null, chunk);
    }
}

/*** functions ***/
async function parseMultiPartBody(ctx: PipeContext<any, any>, route: Route<any>, bodyLimit: number) {
    return new Promise<{ fields: Record<string, string>, files: Record<string, FileUpload[]> }>((resolve, reject) => {
        /* variables */
        const fields: Record<string, string> = {};
        const files: Record<string, FileUpload[]> = {};
        const pendingFileWrites: Promise<void>[] = [];
        // activeWrites will be cleaned if a writestream finishes itself
        const activeWrites = new Set<{ fileStream: Stream.Readable, writeStream: Stream.Writable }>();
        let settled = false;
        const byteGuard = new ByteLimitGuard(bodyLimit);

        /* create busboy instance */
        const bb = Busboy({ headers: ctx.req.headers });

        /* functions */
        // unpipeing
        function unpipeAll(): void {
            byteGuard.unpipe(bb);
            ctx.req.unpipe(byteGuard);
        }

        // cleanup on success
        function cleanupSuccess(): void {
            unpipeAll();
            byteGuard.removeAllListeners();
            byteGuard.destroy();
            bb.destroy();
            // we dont remove BB listerns to avoid the internal error emitter to be emitted into "uncaught" exepections area
        }

        // cleanup on error
        function cleanupError(): void {
            unpipeAll();

            // pause the incoming req. stream to create backpressure (incoming TCP stream will be limited by OS) and avoid unintended memory/CPU usage
            ctx.req.pause();

            byteGuard.removeAllListeners();
            byteGuard.destroy();

            // bb will not destroyed here, because there might be open / unfished filestreams, which needs to be finished before destryosing it
            // we dont remove BB listerns to avoid the internal error emitter to be emitted into "uncaught" exepections area
        }

        // abort current active write streams
        function abortActiveWrites(): void {
            for (const entry of activeWrites) {
                const { fileStream, writeStream } = entry;
                fileStream.unpipe(writeStream);
                // 'error' listeners are still present but wont trigger abort cause of settled flag
                writeStream.destroy();
                fileStream.destroy();
            }
        }

        // abort and reject the parsing
        const settleReject = (err: Error): void => {
            if (settled) return;
            settled = true;

            cleanupError();
            abortActiveWrites();

            // wait for all writes to be "finished" before rejecting the parsing
            Promise.allSettled(pendingFileWrites)
                .finally(() => {
                    // its save to destory bb now because all streams are finished now
                    // bb listerns still present but wont trigger abort again
                    bb.destroy();

                    // save files into ctx to allow global cleanup after the req is finsihed
                    ctx.files = files;
                    reject(err);
                });
        };

        /* setup handler */
        // error in byte guard (limit exceeded)
        byteGuard.on('error', (err) => {
            // TODO: it can only be a PipeErr
            settleReject(err);
        });

        // bb field event
        bb.on("field", (name, value) => {
            fields[name] = value;
        });

        // bb file event
        bb.on("file", (name, fileStream, info) => {
            /* withdraw file if parsing is settled already */
            if (settled) {
                /* already "done"
*/                fileStream.on('error', () => { });  // unhandled error events will be handled as uncaught execptions
                fileStream.resume();
                return;
            }

            /* check if file is allowed */
            if (
                !route.files ||             // no files definied
                (
                    route.files &&          // files definied
                    !(name in route.files)  // but current file is not "allowed"
                )
            ) {
                /* skip file */
                fileStream.on('error', () => { });  // unhandled error events will be handled as uncaught execptions
                fileStream.resume();
                return;
            }

            /* valid file, store it */
            const { filename, encoding, mimeType } = info;
            const filePath = path.join(os.tmpdir(), `${fastUUID()}_${filename}`);
            const writeStream = createWriteStream(filePath);

            /* create result */
            const fileInfo: FileUpload = {
                filename: filename,
                encoding: encoding,
                size: 0,
                mimeType: mimeType,
                path: filePath
            };
            /* save to result */
            // -> in case of failure the path is visible from outside, so it can be used for cleanup #
            if (!files[name]) files[name] = [];
            files[name].push(fileInfo);

            /* create stream couple */
            const streamEntry = { fileStream, writeStream };
            activeWrites.add(streamEntry);

            /* file size counter */
            fileStream.on("data", (chunk: Buffer) => {
                fileInfo.size += chunk.length;
            });

            /* create writeStream promise */
            const writePromise = new Promise<void>((res, rej) => {
                let localSettled = false;

                writeStream.on('close', () => {
                    if (localSettled) return;
                    localSettled = true;
                    /* delete entry from list to avoid double "end" */
                    activeWrites.delete(streamEntry);
                    res();
                });

                fileStream.on('error', (err: Error) => {
                    if (localSettled) return;
                    if (settled) {
                        /* already in end / reject flow */
                        writeStream.destroy();
                        return;
                    }
                    localSettled = true;
                    activeWrites.delete(streamEntry);
                    rej(err);
                });

                writeStream.on('error', (err: Error) => {
                    if (localSettled) return;
                    if (settled) return;
                    localSettled = true;
                    activeWrites.delete(streamEntry);
                    rej(err);
                });
            });

            /* pipe stream to write it on disc & add promise to pending list */
            fileStream.pipe(writeStream);
            pendingFileWrites.push(writePromise);
        });

        // bb error event
        bb.on("error", (err: Error) => {
            settleReject(err);
        });

        // bb close event
        bb.on('close', () => {
            if (settled) return;

            /* wait for all pending files to finish or fail */
            Promise.all(pendingFileWrites)
                .then(() => {
                    /* all parsing successfull and all files saved locally */
                    settled = true;
                    cleanupSuccess();
                    resolve({ fields, files });
                })
                .catch((err: Error) => settleReject(err));
        })

        /* start parsing by piping bb */
        ctx.req.pipe(byteGuard).pipe(bb);
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
function parseCookies(ctx: PipeContext<any, any>): Record<string, string> {
    const header = ctx.req.headers.cookie;
    if (!header) return {};

    const cookies: Record<string, string> = {};
    /* cookies are joined with ";" */
    for (const pair of header.split(';')) {
        /* find first "=" -> seperation key=value;  In value a "=" is also valid */
        const eqIdx = pair.indexOf('=');
        if (eqIdx < 0) continue;
        const key = pair.slice(0, eqIdx).trim();
        const val = pair.slice(eqIdx + 1).trim();
        if (!key) continue;
        try {
            cookies[key] = decodeURIComponent(val);
        } catch {
            cookies[key] = val; // malformed encoding → raw value
        }
    }
    return cookies;
}

/*** body-parser stage ***/
export const parseAndValidateRequestStage = (route: Route<any>, options: RequestParserOptions): PipeStage<void> => {
    const opts = { ...DEFAULT_OPTS, ...options };
    return {
        handler: async (ctx) => {
            /**
             * COOKIES (raw and typed)
             */
            ctx.rawCookies = parseCookies(ctx);
            if (route.cookies) {
                try {
                    ctx.cookies = route.cookies.validate(ctx.rawCookies);
                }
                catch (e) {
                    if (e instanceof TypeError) {
                        throw new ValidationPipeErr(`Cookie validation failed: ${e.message}`);
                    }
                    throw new BadRequestPipeErr('Cookie validation failed (unknown failure)');
                }
            }
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
            const contentLen = parseInt(ctx.req.headers['content-length'] || '0');
            const isBodyMethod = ALLOWED_BODY_METHODS.includes(ctx.req.method as HTTPMethod);
            // extract body limit from global config or route specifc options
            const bodyLimit = route.bodyLimit !== undefined
                ? route.bodyLimit
                : opts.bodyLimit;

            /* stop if payload to big */
            if (bodyLimit > 0 && contentLen > bodyLimit) {
                /* body to big */
                ctx.req.pause();
                throw new ContentTooLargePipeErr(bodyLimit, contentLen);
            }

            /* ignore body if not needed */
            if (!isBodyMethod || (!route.body && !route.files)) {
                /* just ignore body to avoid backpressure */
                ctx.req.resume();
                // TODO: use pause??
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
                    const { fields, files } = await parseMultiPartBody(ctx, route, bodyLimit);
                    ctx.files = files;  /* only files in ctx.files are considered */

                    if (route.body) {
                        ctx.body = fields;
                        ctx.rawBody = '';
                    }
                    else {
                        /* make sure body is not validated & undefined */
                        ctx.body = undefined;
                        validateBody = false;
                    }
                }
                catch (e) {
                    if (e instanceof PipeError) {
                        throw e;
                    }
                    else if (e instanceof Error) {
                        throw new BadRequestPipeErr(e.message);
                    }
                    // TODO: ignore?
                }
            }
            else {
                /* normal content will be read buffered into RAM */
                /* get data from stream */
                const chunks: Buffer[] = [];
                let size = 0;
                for await (const chunk of ctx.req as AsyncIterable<Buffer>) {
                    size += chunk.length;

                    if (bodyLimit > 0 && size > bodyLimit) {
                        chunks.length = 0;  // clear buffered data
                        ctx.req.pause();
                        throw new ContentTooLargePipeErr(bodyLimit, size);
                    }
                    chunks.push(chunk);
                }
                if (!size) {
                    ctx.body = undefined;
                }
                else {
                    /* parse data */
                    const rawData = Buffer.concat(chunks);

                    try {
                        ctx.rawBody = rawData.toString('utf-8');
                        if (isContentType(contentType, 'application/json')) {
                            ctx.body = JSON.parse(ctx.rawBody);
                        }
                        else if (isContentType(contentType, 'application/x-www-form-urlencoded')) {
                            ctx.body = Object.fromEntries(new URLSearchParams(ctx.rawBody));
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