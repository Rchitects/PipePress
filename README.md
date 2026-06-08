# PipePress

PipePress is a high-performance, Express-inspired Node.js web framework that replaces traditional middleware call stacks with precompiled request pipelines. It is designed for fast routing, modular stage composition, schema-based validation, and compact response serialization.

## Highlights
- ⚡ Precompiled route pipelines for minimal dispatch overhead
- 🧱 Composable stages: global, router-level, route-level
- 📦 Request parsing with built-in body, query, params, cookies and multipart file support
- 🍪 Cookie handling with parsed request cookies and response `Set-Cookie` support
- 🧠 TypeScript-friendly schema validation with `datatypes`
- 🚀 Fast JSON serialization via `fast-json-stringify`
- 🌐 Automatic CORS preflight support
- 🔍 Built-in helper stages: `basicHTTPLogger`, `rateLimiter`
- 🧪 Inject testing support via `app.inject()`

## Installation

```bash
npm install @rchitects/pipepress
```

## Quick Start

```ts
import { PipePress, Router, basicHTTPLogger, rateLimiter } from "@rchitects/pipepress";
import dt from "@rchitects/pipepress/dist/core/datatypes";

const app = new PipePress({ cors: { preflight: 'auto' }, maxBodyLength: 10_000_000 });
app.use(basicHTTPLogger());
app.use(rateLimiter({ maxRequests: 20, windowMs: 10_000 }));

const api = new Router();
api.get('/:id', { params: dt.Object({ id: dt.String() }) }, async (ctx) => {
  return { id: ctx.params.id, message: 'Hello from PipePress' };
});

app.mount('/api', api);
app.build();
await app.listen(4000);
```

## Core Concepts

### App lifecycle
- `new PipePress(options)` creates a new application instance
- `app.use(stage)` adds a global stage
- `app.build()` compiles routes and prepares the router
- `app.listen(port)` starts the HTTP server
- `app.close()` shuts down the server gracefully

### Router composition
- `const router = new Router()` creates a nested router
- `router.use(stage)` adds router-specific stages
- `app.mount('/prefix', router)` mounts a router under a path prefix

### Route definitions
Supported HTTP methods:
- `get`, `post`, `put`, `patch`, `delete`

Routes can be declared as:
- `router.get('/path', handler)`
- `router.post('/path', options, handler)`

Route `options` may include:
- `params`: URL parameter schema
- `query`: query string schema
- `body`: request body schema
- `cookies`: request cookie schema
- `files`: multipart file options
- `response`: response schema for fast serialization
- `stages`: route-local stages
- `contentType`: custom response content type

### Built-in pipelines
Each route pipeline automatically includes:
1. inherited stages from parent routers
2. router-level stages
3. the internal request parser/validator stage
4. route-level stages
5. the route handler

## Schema validation

PipePress provides a lightweight `datatypes` schema API:

```ts
import dt from "@rchitects/pipepress/dist/core/datatypes";

const bodySchema = dt.Object({
  name: dt.String(),
  age: dt.Number().isOptional(),
});
```

Supported validators include:
- `dt.String()`
- `dt.Number()`
- `dt.Boolean()`
- `dt.Date()`
- `dt.Array().of(...)`
- `dt.Object({...})`

Validation is applied for:
- path `params`
- query string values
- JSON / URL-encoded request bodies
- request cookies when `cookies` are declared
- multipart form-body fields when `files` are declared

## Response handling

PipePress returns values from route handlers automatically as JSON with status `200`. For custom responses, use `pipeResponse()`:

```ts
import { HTTPStatus, pipeResponse } from "@rchitects/pipepress";

return pipeResponse({
  status: HTTPStatus.FOUND,
  headers: { Location: "https://example.com" },
  body: { message: "redirect" },
});
```

Custom non-JSON content types are also supported via the route `contentType` option.

`pipeResponse()` also supports response cookies with `cookies: [{ name, value, ...options }]`:

```ts
import { HTTPStatus, pipeResponse } from "@rchitects/pipepress";

return pipeResponse({
  status: HTTPStatus.FOUND,
  headers: { Location: "https://example.com" },
  cookies: [{ name: 'session', value: 'abc123', httpOnly: true, path: '/' }],
  body: { message: "redirect" },
});
```

## Error handling

PipePress includes built-in error classes and a default error fallback:
- `BadRequestPipeErr`
- `ValidationPipeErr`
- `ContentTooLargePipeErr`
- `TooManyRequestsPipeErr`
- `NotFoundPipeErr`
- `DefaultPipeErr`

A custom not-found handler can be registered with `app.setNotFoundHandler(...)`.

## CORS support

The framework can generate automatic CORS support when configured:

```ts
const app = new PipePress({ cors: { preflight: 'auto' } });
```

This enables `OPTIONS` preflight routes automatically and sets common CORS response headers.

## Built-in stages

### basicHTTPLogger
Logs request start / finish events, response status and duration.

### rateLimiter
Simple in-memory rate limiter with optional delay and request window control.

## Testing and injection

`app.inject()` allows internal request simulation without starting the HTTP server:

```ts
const result = await app.inject({ method: 'GET', url: '/api/1' });
console.log(result.statusCode, result.json());
```

## Benchmark

A benchmark harness is included under `benchmark/` and can be executed with:

```bash
npm run benchmark
```

Current benchmark results from the repository:

| (index) | name      | rps     | latency | throughput | memoryMB |
|---------|-----------|---------|---------|------------|----------|
| 0       | express   | 5577.25 | 17.44   | 1.53 MB/s  | 124.12   |
| 1       | fastify   | 13421.6 | 6.83    | 2.87 MB/s  | 124.90   |
| 2       | nest      | 5006.11 | 19.50   | 1.40 MB/s  | 163.67   |
| 3       | pipepress | 17476.80 | 5.16    | 4.22 MB/s  | 78.70    |

## Example project

See `example/index.ts` for a working demonstration of:
- request validation
- nested routers
- cookie parsing and `Set-Cookie` response support
- file upload handling
- custom route stages
- CORS support
- custom status and headers via `pipeResponse`

## Future work

Planned improvements and known limitations:
- add a global custom error handler API
- improve TypeScript route/stage typing and ctx type safety
- extend route methods to support `HEAD`, `OPTIONS`, and other HTTP verbs explicitly
- add Express-compatible middleware adapters
- support streaming request bodies instead of buffering all payloads in memory
- enforce multipart file limits and validate file upload metadata
- make CORS origin/headers configuration more flexible
- implement route-specific response headers on plain handler returns
- add more integration and unit tests for edge cases

## License
MIT

