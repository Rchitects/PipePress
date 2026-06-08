/*** imports ***/
import { IncomingMessage, ServerResponse } from "http";
import { HTTPContentType, HTTPStatus, PIPE_RESPONSE_BRAND, PipeResponse, SetCookieEntry, SetCookieOptions, stringyfy } from "./models";

/*** functions ***/
export const isContentType = (source: HTTPContentType | string, ofType: HTTPContentType): boolean => {
    return source.toString().includes(ofType);
}
export const fastUUID = (time: number = Date.now()) => {
    const tsHex = time.toString(16).padStart(12, "0");
    const randHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0");
    return tsHex + randHex; /* always 18 characters long -- 12 from timestamp, 6 from random */
};
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export const getIP = (req: IncomingMessage): string => {
    const forwardedFor = req.headers['x-forwarded-for'];

    if (forwardedFor && typeof forwardedFor === 'string') {
        const ips = forwardedFor.split(',');
        return ips[0].trim();
    }

    return req.socket.remoteAddress || 'unknown';
}
export const isPipeResponse = (value: unknown): value is PipeResponse => {
    return (
        typeof value === 'object' &&
        value !== null &&
        PIPE_RESPONSE_BRAND in value
    );
}
export const pipeResponse = <Body = any>(opts: {
    status: HTTPStatus;
    body?: Body;
    headers?: Record<string, string>;
    serializer?: stringyfy<Body>;
    contentType?: HTTPContentType;
    cookies?: SetCookieEntry[];
}): PipeResponse<Body> => {
    return { [PIPE_RESPONSE_BRAND]: true, ...opts };
}

/**
 * COOKIES
 */
// RFC 6265 + RFC 2616 token: ASCII printable, ohne Separatoren
const INVALID_COOKIE_NAME = /[^\x21\x23-\x27\x2A\x2B\x2D\x2E\x30-\x39\x41-\x5A\x5E-\x7A\x7C\x7E]/;

export const serializeCookie = (name: string, value: string, opts: SetCookieOptions = {}): string => {
    if (!name || INVALID_COOKIE_NAME.test(name)) {
        throw new TypeError(`Invalid cookie name: "${name}"`);
    }
    let str = `${name}=${encodeURIComponent(value)}`;

    if (opts.maxAge !== undefined) str += `; Max-Age=${Math.trunc(opts.maxAge)}`;
    if (opts.expires) str += `; Expires=${opts.expires.toUTCString()}`;
    str += `; Path=${opts.path ?? '/'}`;
    if (opts.domain) str += `; Domain=${opts.domain}`;
    if (opts.secure) str += `; Secure`;
    if (opts.httpOnly) str += `; HttpOnly`;
    if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
    if (opts.partitioned) str += `; Partitioned`;

    return str;
}

export const setCookie = (res: ServerResponse, name: string, value: string, opts: SetCookieOptions = {}): void => {
    const serialized = serializeCookie(name, value, opts);
    const existing = res.getHeader('Set-Cookie');
    if (Array.isArray(existing)) {
        res.setHeader('Set-Cookie', [...existing, serialized]);
    } else if (typeof existing === 'string') {
        res.setHeader('Set-Cookie', [existing, serialized]);
    } else {
        res.setHeader('Set-Cookie', serialized);
    }
}
export const clearCookie = (res: ServerResponse, name: string, opts: Omit<SetCookieOptions, 'maxAge' | 'expires'> = {}): void => {
    /* clear a cookie by setting maxAge and expires */
    setCookie(res, name, '', {
        ...opts,
        maxAge: 0,
        expires: new Date(0),
    });
}