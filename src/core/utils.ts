/*** imports ***/
import { IncomingMessage } from "http";
import { HTTPContentType, HTTPStatus, PIPE_RESPONSE_BRAND, PipeResponse, stringyfy } from "./models";

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
}): PipeResponse<Body> => {
    return { [PIPE_RESPONSE_BRAND]: true, ...opts };
}