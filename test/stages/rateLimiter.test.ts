/*** imports ***/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { basicHTTPLogger, PipePress, rateLimiter } from "../../src";
import autocannon from "autocannon";

/*** varbs ***/
let app: PipePress;
let port = 0;

/*** test ***/
describe("Rate Limiter Stage", () => {
    beforeAll(async () => {
        app = new PipePress();

        app.use(rateLimiter());

        app.get('/ping', async (ctx) => {
            return { message: 'pong' };
        });

        app.build();
        port = await app.listen(0);
    });

    afterAll(() => {
        app.close();
    });

    it("should use x-forwarded-for header for IP", async () => {
        const res = await fetch(`http://localhost:${port}/ping`, {
            headers: {
                "x-forwarded-for": "1.2.3.4"
            }
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ message: 'pong' });
    });

    it("should use x-forwarded-for header for IP with multiple IPs", async () => {
        const res = await fetch(`http://localhost:${port}/ping`, {
            headers: {
                "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12"
            }
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ message: 'pong' });
    });

    // it("should limit requests", async () => {
    //     const stats = {
    //         ok: 0,
    //         limited: 0
    //     };

    //     const result = await autocannon({
    //         url: `http://localhost:${port}/ping`,
    //         connections: 20,
    //         duration: 3,
    //         amount: 100,
    //         setupClient: (client) => {
    //             client.on('response', (statusCode) => {
    //                 if (statusCode === 200) {
    //                     stats.ok++;
    //                 }
    //                 else {
    //                     stats.limited++;
    //                 }
    //             });
    //         }
    //     });

    //     expect(stats.limited).toBeGreaterThan(0);
    // });

    // it("should limit and reset the requests after window", async () => {
    //     const stats = {
    //         ok: 0,
    //         limited: 0
    //     };

    //     // first 10 ok and 90 will fail
    //     const result = await autocannon({
    //         url: `http://localhost:${port}/ping`,
    //         connections: 20,
    //         duration: 3,
    //         amount: 100,
    //         setupClient: (client) => {
    //             client.on('response', (statusCode) => {
    //                 if (statusCode === 200) {
    //                     stats.ok++;
    //                 }
    //                 else {
    //                     stats.limited++;
    //                 }
    //             });
    //         }
    //     });
    //     // wait for window to reset
    //     await new Promise((resolve) => setTimeout(resolve, 1500));

    //     // than another requests which should be ok again
    //     const result2 = await fetch(`http://localhost:${port}/ping`);
    //     if (result2.status === 200) {
    //         stats.ok++;
    //     };

    //     expect(stats.limited).toBeGreaterThan(0);
    //     expect(stats.ok).toEqual(11);
    // });

    // it("should limit the reqeusts and delay the response", async () => {
    //     const app2 = new PipePress();
    //     app2.use(basicHTTPLogger());
    //     app2.use(rateLimiter({ maxRequests: 10, windowMs: 1000, delayMs: 10 }));
    //     app2.get('/ping', async (ctx) => { return { message: 'pong' }; });
    //     app2.build();
    //     await app2.listen(4001);

    //     const stats = {
    //         ok: 0,
    //         limited: 0
    //     };

    //     // send request
    //     const result = await autocannon({
    //         url: "http://localhost:4001/ping",
    //         connections: 20,
    //         duration: 3,
    //         amount: 50,
    //         setupClient: (client) => {
    //             client.on('response', (statusCode) => {
    //                 if (statusCode === 200) {
    //                     stats.ok++;
    //                 }
    //                 else {
    //                     stats.limited++;
    //                 }
    //             });
    //         }
    //     });

    //     // end
    //     await app2.close();

    //     expect(stats.limited).toBeGreaterThan(0);
    // }, 10_000);
});