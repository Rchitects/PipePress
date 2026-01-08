/*** imports ***/
import { IncomingMessage } from "http"
import { PipeStage } from "../core/types"
import { sleep } from "../core/utils";
import { TooManyRequestsPipeErr } from "../core/error";

/*** types ***/
type RateLimitRecord = {
    count: number;
    startMs: number;
}
type RateLimitConfig = {
    maxRequests?: number;
    windowMs?: number;
    delayMs?: number;
}

/*** defintions ***/
const rateLimitRecords: Map<string, RateLimitRecord> = new Map();
const RATE_LIMIT_CONFIG_DEFAULT: Required<RateLimitConfig> = {
    maxRequests: 10,
    windowMs: 10000,
    delayMs: 0
}

/*** functions ***/
function getIP(req: IncomingMessage): string {
    const forwardedFor = req.headers['x-forwarded-for'];

    if (forwardedFor && typeof forwardedFor === 'string') {
        const ips = forwardedFor.split(',');
        return ips[0].trim();
    }

    return req.socket.remoteAddress || 'unknown';
}

/*** stage-handler ***/
export const rateLimiter = (config?: RateLimitConfig): PipeStage<void> => {
    const options: Required<RateLimitConfig> = { ...RATE_LIMIT_CONFIG_DEFAULT, ...config };

    return {
        handler: async (ctx) => {
            const now = Date.now();

            /* extract IP */
            const IP = getIP(ctx.req);

            /* get or create record */
            let record = rateLimitRecords.get(IP);
            if (!record) {
                record = {
                    count: 1,
                    startMs: now
                };
                rateLimitRecords.set(IP, record);
            }
            else if (now - record.startMs > options.windowMs) {
                /* time window exceed, reset the record */
                record.count = 1;
                record.startMs = now;
            }
            else {
                /* request is inside the time window */
                record.count++;
                if (record.count > options.maxRequests) {
                    /* report rate limit exceeded */
                    // TODO:
                    console.warn(`[RateLimiter] IP ${IP} has exceeded the request limit of ${options.maxRequests} requests per ${options.windowMs} ms.`);

                    /* apply delay if configured */
                    if (options.delayMs > 0) {
                        await sleep(options.delayMs * (record.count - options.maxRequests));
                    }

                    /* throw error to send response to user */
                    const retryAfterMs = options.windowMs - (now - record.startMs);
                    throw new TooManyRequestsPipeErr(retryAfterMs, options.maxRequests, record.count);
                }
            }
        }
    }
}