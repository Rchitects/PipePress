/*** imports ***/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PipePress } from "../../src";
import dt from "../../src/core/datatypes";
import http from "http";

/*** helpers ***/
let app: PipePress;
let port = 0;

async function postJSON(url: string, body: any, headers?: Record<string, string>) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(body)
    });
}

/*** test ***/
describe("Request Parser Stage", () => {
    beforeAll(async () => {
        app = new PipePress();

        /**
         * BODY PARSING - JSON
         */
        app.post('/body-json', {
            body: dt.Object({ name: dt.String(), age: dt.Number() })
        }, async (ctx) => {
            return { received: ctx.body };
        });

        /**
         * BODY PARSING - URL ENCODED
         */
        app.post('/body-form', {
            body: dt.Object({ username: dt.String(), password: dt.String() })
        }, async (ctx) => {
            return { received: ctx.body };
        });

        /**
         * BODY PARSING - NO BODY EXPECTED
         */
        app.post('/no-body', async (ctx) => {
            return { hasBody: ctx.body !== undefined };
        });

        /**
         * QUERY PARAMETERS
         */
        app.get('/query-params', {
            query: dt.Object({ search: dt.String(), limit: dt.String(), flag: dt.String() })
        }, async (ctx) => {
            return { query: ctx.query };
        });

        /**
         * QUERY NORMALIZATION - EMPTY VALUES AND ARRAYS
         */
        app.get('/query-normalize', async (ctx) => {
            return { query: ctx.query };
        });

        /**
         * PARAMS
         */
        app.get('/user/:id', {
            params: dt.Object({ id: dt.String() })
        }, async (ctx) => {
            return { userId: ctx.params.id };
        });

        /**
         * COOKIES
         */
        app.get('/cookies', {
            cookies: dt.Object({ sessionId: dt.String(), token: dt.String() })
        }, async (ctx) => {
            return { cookies: ctx.cookies };
        });

        /**
         * COOKIES - RAW (no validation)
         */
        app.get('/cookies-raw', async (ctx) => {
            return { cookies: ctx.rawCookies };
        });

        /**
         * BODY LIMIT - GLOBAL
         */
        app.post('/body-limit-global', {
            body: dt.Object({ data: dt.String() })
        }, async (ctx) => {
            return { received: ctx.body };
        });

        /**
         * BODY LIMIT - ROUTE SPECIFIC
         */
        app.post('/body-limit-route', {
            body: dt.Object({ data: dt.String() }),
            bodyLimit: 200
        }, async (ctx) => {
            return { received: ctx.body };
        });

        /**
         * FILES - OPTIONAL
         */
        app.post('/upload-optional', {
            files: {
                document: { required: false }
            }
        }, async (ctx) => {
            return {
                hasFile: ctx.files?.document !== undefined,
                count: ctx.files?.document?.length ?? 0
            };
        });

        /**
         * FILES - REQUIRED BUT MISSING
         */
        app.post('/upload-required', {
            files: {
                avatar: { required: true }
            }
        }, async (ctx) => {
            return { success: true };
        });

        /**
         * GET - NO BODY EXPECTED
         */
        app.get('/get-no-body', async (ctx) => {
            return { body: ctx.body };
        });

        /**
         * DELETE - BODY ALLOWED
         */
        app.delete('/delete-body', {
            body: dt.Object({ id: dt.String() })
        }, async (ctx) => {
            return { id: ctx.body?.id };
        });

        /**
         * PUT - BODY ALLOWED
         */
        app.put('/put-body', {
            body: dt.Object({ data: dt.String() })
        }, async (ctx) => {
            return { data: ctx.body?.data };
        });

        /**
         * PATCH - BODY ALLOWED
         */
        app.patch('/patch-body', {
            body: dt.Object({ data: dt.String() })
        }, async (ctx) => {
            return { data: ctx.body?.data };
        });

        /**
         * RAW BODY CAPTURE
         */
        app.post('/raw-body', {
            body: dt.Object({ value: dt.String() })
        }, async (ctx) => {
            return { rawBody: ctx.rawBody };
        });

        /**
         * EMPTY BODY
         */
        app.post('/empty-body', async (ctx) => {
            return { body: ctx.body };
        });

        app.build();
        port = await app.listen(0);
    });

    afterAll(() => {
        app.close();
    });

    describe("Body Parsing - JSON", () => {
        it("should parse valid JSON body", async () => {
            const res = await postJSON("http://localhost:" + port + "/body-json", {
                name: "John",
                age: 30
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.received).toEqual({ name: "John", age: 30 });
        });

        it("should fail on invalid JSON", async () => {
            const res = await fetch("http://localhost:" + port + "/body-json", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{invalid json'
            });
            expect(res.status).toBe(400);
        });

        it("should fail on validation error", async () => {
            const res = await postJSON("http://localhost:" + port + "/body-json", {
                name: "John"
            });
            expect(res.status).toBe(400);
        });

        it("should capture raw JSON body", async () => {
            const res = await postJSON("http://localhost:" + port + "/raw-body", {
                value: "test"
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.rawBody).toContain('"value"');
            expect(data.rawBody).toContain('"test"');
        });
    });

    describe("Body Parsing - URL Encoded", () => {
        it("should parse URL encoded body", async () => {
            const res = await fetch("http://localhost:" + port + "/body-form", {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    username: "admin",
                    password: "secret"
                }).toString()
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.received).toEqual({ username: "admin", password: "secret" });
        });

        it("should fail on validation error", async () => {
            const res = await fetch("http://localhost:" + port + "/body-form", {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: "admin" }).toString()
            });
            expect(res.status).toBe(400);
        });
    });

    describe("File Upload - Required Files", () => {
        it("should upload a single required file", async () => {
            const form = new FormData();
            form.append('avatar', new Blob([Buffer.from("image data content")]), 'avatar.jpg');

            const res = await fetch("http://localhost:" + port + "/upload-required", {
                method: 'POST',
                body: form
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
        });

        it("should fail when required file is missing", async () => {
            const form = new FormData();
            // Send empty form without the required 'avatar' file

            const res = await fetch("http://localhost:" + port + "/upload-required", {
                method: 'POST',
                body: form as any
            });
            // Should fail - missing required file
            expect(res.status).toBe(400);
        });
        it("should reject file that is too large", async () => {
            const boundary = '---------------------------1234567890123456789012345678';

            // HTTP Request manuell aufbauen OHNE Content-Length
            const req = http.request({
                hostname: 'localhost',
                port: port,
                path: '/upload-required',
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Transfer-Encoding': 'chunked', // Streaming erzwingen
                    // Content-Length bewusst WEGLASSEN!
                }
            });

            // Promise für die Antwort aufbauen
            const responsePromise = new Promise<{ statusCode?: number, body: string }>((resolve, reject) => {
                req.on('response', (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
                });
                req.on('error', reject);
            });

            // Payload schreiben, der dein Body-Limit überschreitet
            const multipartHeader = `--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="large.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
            const fakeImageData = Buffer.alloc(2000000, 'a'); // 2MB
            const multipartFooter = `\r\n--${boundary}--\r\n`;

            req.write(multipartHeader);
            req.write(fakeImageData);
            req.write(multipartFooter);
            req.end();

            try {
                const res = await responsePromise;
                // Entweder 413...
                expect(res.statusCode).toBe(413);
            } catch (err: any) {
                // ...oder Socket Reset wegen Connection: Close / req.destroy()
                expect(['ECONNRESET', 'UND_ERR_SOCKET', 'socket hang up']).toContain(err.code || err.message);
            }
        });
    });

    describe("File Upload - Optional Files", () => {
        it("should fail when required file is missing (empty form)", async () => {
            // Sending content-type multipart without actual data triggers parsing error
            // This is expected behavior - malformed multipart data
            const res = await fetch("http://localhost:" + port + "/upload-required", {
                method: 'POST',
                headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
                body: '--test--'
            });
            // Server responds with 400 (Bad Request) for malformed multipart
            expect([400, 500]).toContain(res.status);
        });
    });

    describe("Query Parameters", () => {
        it("should parse and validate query parameters", async () => {
            const res = await fetch("http://localhost:" + port + "/query-params?search=test&limit=10&flag=active");
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.query.search).toBe("test");
            expect(data.query.limit).toBe("10");
            expect(data.query.flag).toBe("active");
        });

        it("should handle missing query parameters", async () => {
            const res = await fetch("http://localhost:" + port + "/query-params");
            expect(res.status).toBe(400);
        });

        it("should normalize empty query parameters to boolean", async () => {
            const res = await fetch("http://localhost:" + port + "/query-normalize?flag&key=value");
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.query.flag).toBe(true);
            expect(data.query.key).toBe("value");
        });

        it("should handle array query parameters (last value wins)", async () => {
            const res = await fetch("http://localhost:" + port + "/query-normalize?id=1&id=2&id=3");
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.query.id).toBe("3");
        });
    });

    describe("Path Parameters", () => {
        it("should parse and validate path parameters", async () => {
            const res = await fetch("http://localhost:" + port + "/user/123");
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.userId).toBe("123");
        });
    });

    describe("Cookies - Parsed & Validated", () => {
        it("should parse and validate cookies", async () => {
            const res = await fetch("http://localhost:" + port + "/cookies", {
                headers: {
                    'Cookie': 'sessionId=abc123; token=xyz789'
                }
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.cookies.sessionId).toBe("abc123");
            expect(data.cookies.token).toBe("xyz789");
        });

        it("should handle empty cookie string", async () => {
            const res = await fetch("http://localhost:" + port + "/cookies", {
                headers: {
                    'Cookie': ''
                }
            });
            expect(res.status).toBe(400);
        });

        it("should handle no cookies", async () => {
            const res = await fetch("http://localhost:" + port + "/cookies");
            expect(res.status).toBe(400);
        });
    });

    describe("Cookies - Raw Parsing", () => {
        it("should decode URI encoded cookies", async () => {
            const res = await fetch("http://localhost:" + port + "/cookies-raw", {
                headers: {
                    'Cookie': 'key1=value%20with%20space; key2=normal'
                }
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.cookies.key1).toBe("value with space");
            expect(data.cookies.key2).toBe("normal");
        });

        it("should handle malformed URI encoded cookies", async () => {
            const res = await fetch("http://localhost:" + port + "/cookies-raw", {
                headers: {
                    'Cookie': 'key1=%ZZ; key2=normal'
                }
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.cookies.key1).toBe("%ZZ");
            expect(data.cookies.key2).toBe("normal");
        });

        it("should handle cookies with equals sign in value", async () => {
            const res = await fetch("http://localhost:" + port + "/cookies-raw", {
                headers: {
                    'Cookie': 'token=abc=def=ghi'
                }
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.cookies.token).toBe("abc=def=ghi");
        });

        it("should handle cookies with spacing", async () => {
            const res = await fetch("http://localhost:" + port + "/cookies-raw", {
                headers: {
                    'Cookie': '  key1  =  value1  ;  key2  =  value2  '
                }
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.cookies.key1).toBe("value1");
            expect(data.cookies.key2).toBe("value2");
        });
    });

    describe("Body Limit - Global", () => {
        it("should accept body within global limit", async () => {
            const res = await postJSON("http://localhost:" + port + "/body-limit-global", {
                data: "small"
            });
            expect(res.status).toBe(200);
        });

        it("should handle reasonable large body", async () => {
            const mediumData = "x".repeat(100000);
            const res = await postJSON("http://localhost:" + port + "/body-limit-global", {
                data: mediumData
            });
            expect(res.status).toBe(200);
        });
    });

    describe("Body Limit - Route Specific", () => {
        it("should accept body within route limit", async () => {
            const res = await postJSON("http://localhost:" + port + "/body-limit-route", {
                data: "x".repeat(50)
            });
            expect(res.status).toBe(200);
        });

        it("should reject body exceeding route limit with 413", async () => {
            // Route has bodyLimit of 200 bytes
            // JSON wrapper: {"data":"..."} adds ~11 chars
            // So 200 char string should exceed it
            const largeData = "x".repeat(200);
            const res = await postJSON("http://localhost:" + port + "/body-limit-route", {
                data: largeData
            });
            expect(res.status).toBe(413);
        });

        it("should reject body well over limit with 413", async () => {
            const hugeData = "x".repeat(500);
            const res = await postJSON("http://localhost:" + port + "/body-limit-route", {
                data: hugeData
            });
            expect(res.status).toBe(413);
        });
    });

    describe("HTTP Methods - Body Handling", () => {
        it("GET should not send body", async () => {
            const res = await fetch("http://localhost:" + port + "/get-no-body", {
                method: 'GET'
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.body).toBeUndefined();
        });

        it("PUT should parse body", async () => {
            const res = await fetch("http://localhost:" + port + "/put-body", {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: "updated" })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data).toBe("updated");
        });

        it("PATCH should parse body", async () => {
            const res = await fetch("http://localhost:" + port + "/patch-body", {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: "patched" })
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data).toBe("patched");
        });
    });

    describe("Content Types", () => {
        it("should handle JSON with charset", async () => {
            const res = await postJSON("http://localhost:" + port + "/body-json", {
                name: "John",
                age: 30
            }, {
                'Content-Type': 'application/json; charset=utf-8'
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.received.name).toBe("John");
        });
    });

    describe("Empty Body", () => {
        it("should handle POST with no body", async () => {
            const res = await fetch("http://localhost:" + port + "/empty-body", {
                method: 'POST'
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.body).toBeUndefined();
        });

        it("should handle POST with empty body", async () => {
            const res = await fetch("http://localhost:" + port + "/empty-body", {
                method: 'POST',
                body: ''
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.body).toBeUndefined();
        });
    });

    describe("No Body Expected", () => {
        it("should skip parsing if body not expected by route", async () => {
            const res = await postJSON("http://localhost:" + port + "/no-body", {
                test: "data"
            });
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.hasBody).toBe(false);
        });
    });

    describe("413 Payload Too Large - Extended Tests", () => {
        it("should respect route-specific limit over global limit", async () => {
            // Route limit is 200 bytes, global is 1MB
            // Route limit should be enforced
            const dataSize = "x".repeat(300);
            const res = await postJSON("http://localhost:" + port + "/body-limit-route", {
                data: dataSize
            });
            expect(res.status).toBe(413);
        });

        it("should enforce route limit of 200 bytes for body-limit-route", async () => {
            // Multiple tests to ensure route limit is strictly enforced
            const data = "x".repeat(250);
            const res = await postJSON("http://localhost:" + port + "/body-limit-route", {
                data: data
            });
            expect(res.status).toBe(413);
        });

        it("should enforce strict body limits at 200 bytes", async () => {
            // Just slightly over the limit
            const data = "x".repeat(210);
            const res = await postJSON("http://localhost:" + port + "/body-limit-route", {
                data: data
            });
            expect(res.status).toBe(413);
        });

        it("should allow body within limit and reject over", async () => {
            // Within limit - should pass
            const data = "x".repeat(50);
            const res1 = await postJSON("http://localhost:" + port + "/body-limit-route", {
                data: data
            });
            expect(res1.status).toBe(200);

            // Over limit - should fail
            const hugeData = "x".repeat(300);
            const res2 = await postJSON("http://localhost:" + port + "/body-limit-route", {
                data: hugeData
            });
            expect(res2.status).toBe(413);
        });

        it("should allow body within global limit", async () => {
            // Global limit is 1MB - this test confirms we can send medium-sized payloads
            const mediumData = "x".repeat(500000);
            const res = await postJSON("http://localhost:" + port + "/body-limit-global", {
                data: mediumData
            });
            expect(res.status).toBe(200);
        });
    });
});
