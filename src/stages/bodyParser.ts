/*** imports ***/
import { BadRequestPipeErr, ContentTooLargePipeErr, ValidationPipeErr } from "../core/error";
import { FileUpload, HTTPContentType, HTTPMethod, PipeContext, PipeStage, Route } from "../core/types";
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

/*** functions ***/
function getMultipartBoundary(contentType: string): string {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!match) throw new Error("Multipart boundary missing");
    return `--${match[1] || match[2]}`;
}
function bufferSplit(buf: Buffer, sep: Buffer): Buffer[] {
    const parts: Buffer[] = [];
    let start = 0;
    let index: number;

    while ((index = buf.indexOf(sep, start)) !== -1) {
        parts.push(buf.subarray(start, index));
        start = index + sep.length;
    }

    parts.push(buf.subarray(start));
    return parts;
}
function parseMultipartHeaders(headerText: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = headerText.split("\r\n");

    for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }

    return headers;
}
function parseContentDisposition(value?: string) {
    if (!value) return null;

    const parts = value.split(";").map(v => v.trim());
    const out: any = {};

    for (const part of parts) {
        if (part === "form-data") continue;
        const eqIdx = part.indexOf("=");
        if (eqIdx === -1) continue;

        const key = part.slice(0, eqIdx);
        const rawVal = part.slice(eqIdx + 1);
        out[key] = rawVal.replace(/^"|"$/g, "");
    }

    return out;
}

function parseMultiPartBody(raw: Buffer, contentType: string) {
    const boundaryStr = getMultipartBoundary(contentType);
    const boundaryBuf = Buffer.from(boundaryStr);
    const parts = bufferSplit(raw, boundaryBuf);

    const fields: Record<string, string> = {};
    const files: Record<string, any[]> = {};

    for (const part of parts) {
        // check for empty parts or end-boundary (char(45) == '-')
        if (part.length < 4 || part[0] === 45 && part[1] === 45) continue;

        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) continue;

        const headerBuf = part.subarray(0, headerEnd).toString("utf8");
        // remove the closing \r\n at the end and infront of next boundary
        const body = part.subarray(headerEnd + 4, part.length - 2);

        const headers = parseMultipartHeaders(headerBuf);
        const disp = parseContentDisposition(headers["content-disposition"]);

        if (!disp || !disp.name) continue;

        if (disp.filename) {
            if (!files[disp.name]) files[disp.name] = [];
            files[disp.name].push({
                field: disp.name,
                filename: disp.filename,
                contentType: headers["content-type"],
                data: body
            });
        } else {
            fields[disp.name] = body.toString("utf8");
        }
    }

    return { fields, files };
}

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
            if (!isBodyMethod || (!route.body && !route.files)) {
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
            const contentType = ctx.req.headers['content-type'] ?? '';
            let validate = true;
            try {
                if (isContentType(contentType, 'application/json')) {
                    ctx.body = JSON.parse(rawData.toString('utf-8'));
                }
                else if (isContentType(contentType, 'application/x-www-form-urlencoded')) {
                    ctx.body = Object.fromEntries(new URLSearchParams(rawData.toString('utf-8')));
                }
                else if (isContentType(contentType, 'multipart/form-data')) {
                    const { fields, files } = parseMultiPartBody(rawData, contentType);
                    ctx.files = files;

                    /* add body only if body parser is provided */
                    if (route.body) {
                        ctx.body = fields;
                    }
                    else {
                        validate = false
                    }
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