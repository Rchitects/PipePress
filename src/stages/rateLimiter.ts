/*** imports ***/
import { TooManyRequestsPipeErr } from "../core/error";
import { PipeStage } from "../core/models";
import { getIP, sleep } from "../core/utils";

/*** types ***/
type BucketRecord = {
    tokens: number;
    lastRefillMs: number;
}
type RateLimitConfig = {
    maxTokens?: number;
    refillAmount?: number;
    refillIntervalMs?: number;
    cleanupAfterMs?: number;
}

/*** defintions ***/
const rateLimitBucket = new Map<string, BucketRecord>();
const RATE_LIMIT_CONFIG_DEFAULT: Required<RateLimitConfig> = {
    maxTokens: 10,
    refillAmount: 1,
    refillIntervalMs: 1000,
    cleanupAfterMs: 60_000
}
let cleanupTask: NodeJS.Timeout | undefined;

/*** stage-handler ***/
export const rateLimiter = (config?: RateLimitConfig): PipeStage<void> => {
    const options: Required<RateLimitConfig> = { ...RATE_LIMIT_CONFIG_DEFAULT, ...config };

    /* create cleanup interval if not present */
    if (!cleanupTask) {
        cleanupTask = setInterval(() => {
            const now = Date.now();
            for (const [ip, bucket] of rateLimitBucket) {
                if (now - bucket.lastRefillMs > options.cleanupAfterMs) {
                    rateLimitBucket.delete(ip);
                }
            }
        }, options.cleanupAfterMs);
    }
    /* create stage */
    return {
        handler: async (ctx) => {
            const now = Date.now();
            const IP = getIP(ctx.req);

            /* get or create bucket */
            let bucket = rateLimitBucket.get(IP);
            if (!bucket) {
                /* first request */
                bucket = {
                    tokens: options.maxTokens - 1,
                    lastRefillMs: now,
                };
                rateLimitBucket.set(IP, bucket);
                return;
            }

            /* refill tokens based on elapsed time */
            const elapsed = now - bucket.lastRefillMs;
            const refillCount = Math.floor(elapsed / options.refillIntervalMs);

            if (refillCount > 0) {
                bucket.tokens = Math.min(
                    options.maxTokens,
                    bucket.tokens + refillCount * options.refillAmount
                );
                /* add the correct amount of ms to the lastRefill */
                bucket.lastRefillMs += refillCount * options.refillIntervalMs;
            }

            /* check if a token is available */
            if (bucket.tokens <= 0) {
                const msUntilNextToken = options.refillIntervalMs - (now - bucket.lastRefillMs);

                console.warn(
                    `[RateLimiter] IP ${IP} — bucket empty. Next token in ${msUntilNextToken}ms.`
                );

                throw new TooManyRequestsPipeErr(msUntilNextToken, options.maxTokens, 0);
            }

            /* tokens are still present and/or got refilled -> just consume one token and go on*/
            bucket.tokens--;
        }
    }
}