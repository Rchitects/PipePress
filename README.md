<p align="center">
  <img src="assets/logo.png" alt="Logo" width="500">
</p>

PipePress is a high-performance, Express-inspired Node.js web framework that replaces traditional middleware call stacks with precompiled request pipelines. It is designed for fast routing, modular stage composition, schema-based validation, and compact response serialization.

[![Test and Build](https://github.com/Rchitects/PipePress/actions/workflows/test_build.yml/badge.svg)](https://github.com/Rchitects/PipePress/actions/workflows/test_build.yml)
![Status](https://img.shields.io/badge/status-beta-yellow)
<!-- When package is available uncomment this
[![npm beta version](https://img.shields.io/npm/v/@rchitects/pipepress/beta)](https://www.npmjs.com/package/@rchitects/pipepress/v/beta)
-->

> ⚠️ **Beta:** PipePress is currently in beta phase

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

## Table of Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [App lifecycle](#app-lifecycle)
  - [Router composition](#router-composition)
  - [Route definitions](#route-definitions)
  - [Built-in pipelines](#built-in-pipelines)
- [Schema validation](#schema-validation)
  - [Literal types](#literal-types)
- [Response handling](#response-handling)
  - [Cookie helpers](#cookie-helpers)
- [Error handling](#error-handling)
- [CORS support](#cors-support)
- [Built-in stages](#built-in-stages)
  - [basicHTTPLogger](#basichttplogger)
  - [rateLimiter](#ratelimiter)
- [Testing and injection](#testing-and-injection)
- [Benchmark](#benchmark)
- [Example project](#example-project)
- [Future work](#future-work)
- [License](#license)

## Installation

```bash
# Install the latest stable release
npm install @rchitects/pipepress

# Or install the beta channel (matching the package version in this repo)
npm install @rchitects/pipepress@beta
```

## Quick Start

```ts
import { PipePress, Router, basicHTTPLogger, rateLimiter } from "@rchitects/pipepress";
import dt from "@rchitects/pipepress/datatypes";

const app = new PipePress({ cors: { preflight: 'auto' }, maxBodyLength: 10_000_000 });
app.use(basicHTTPLogger());
app.use(rateLimiter({ maxTokens: 20, refillAmount: 1, refillIntervalMs: 1000 }));

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
- `bodyLimit`: route specfic body limit in bytes

### Built-in pipelines
Each route pipeline automatically includes:
1. pre-parse stages (`runBeforeParse`)
2. the internal request parser/validator stage
3. inherited stages from parent routers
4. router-level stages
5. route-level stages
6. the route handler

## Schema validation

PipePress provides a lightweight `datatypes` schema API:

```ts
import dt from "@rchitects/pipepress/datatypes";

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
 - `dt.StringLiteral(...values)` — accept only the provided string literal values
 - `dt.NumberLiteral(...values)` — accept only the provided numeric literal values

Validation is applied for:
- path `params`
- query string values
- JSON / URL-encoded request bodies
- request cookies when `cookies` are declared
- multipart form-body fields when `files` are declared

### Literal types

PipePress `datatypes` now includes literal types for restricting values to a fixed set. Use `dt.StringLiteral(...)` or `dt.NumberLiteral(...)` to declare allowed values. These produce an `enum` JSON Schema and validate incoming values accordingly.

```ts
import dt from "@rchitects/pipepress/datatypes";

const color = dt.StringLiteral('red', 'green', 'blue');
const code = dt.NumberLiteral(100, 200);

const schema = dt.Object({
  color: color,
  code: code.isOptional(),
});

// Incoming payload validation will only accept color as 'red'|'green'|'blue'
```

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

For simple redirects, use the `redirect()` helper instead:

```ts
import { redirect } from "@rchitects/pipepress";

return redirect("https://example.com");
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

### Cookie helpers

In addition to returning cookies via `pipeResponse`, PipePress exposes helper functions to manipulate `Set-Cookie` headers directly on the outgoing response.

```ts
import { setCookie, clearCookie } from "@rchitects/pipepress";

// set a cookie on the ServerResponse
setCookie(ctx.res, 'session', 'abc123', { httpOnly: true, path: '/' });

// clear a cookie
clearCookie(ctx.res, 'session');
```

## Error handling

PipePress includes built-in error classes and a default error fallback:
- `InternalPipeErr`
- `BadRequestPipeErr`
- `ValidationPipeErr`
- `ContentTooLargePipeErr`
- `TooManyRequestsPipeErr`
- `RouteNotFoundPipeErr`
- `UnauthorizedPipeErr`
- `ForbiddenPipeErr`

A custom not-found handler can be registered with `app.setNotFoundHandler(...)`.

## CORS support

The framework can generate automatic CORS support when configured:

```ts
const app = new PipePress({ cors: { preflight: 'auto' } });
```

This enables `OPTIONS` preflight routes automatically and sets common CORS response headers.

## Built-in stages

### basicHTTPLogger
Logs request start / finish events, response status and duration. When used globally, it runs before request parsing so it can capture the raw incoming request.

### rateLimiter
Simple in-memory token-bucket rate limiter. Configure the bucket size and refill behaviour using the options shown below.

```ts
// allow bursts of up to 20 requests, refill 1 token per second
app.use(rateLimiter({ maxTokens: 20, refillAmount: 1, refillIntervalMs: 1000 }));

// advanced: refill 20 tokens every 10 seconds
app.use(rateLimiter({ maxTokens: 20, refillAmount: 20, refillIntervalMs: 10_000 }));
```

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

The demo app in `example/index.ts` is a compact showcase of PipePress in action. It starts a small server on port `4000` and exercises many of the framework's core capabilities in one place:

- request validation for params, query strings, JSON bodies and cookies
- nested routers with shared stage state
- multipart file uploads with custom `runBeforeParse` and regular stages
- cookie parsing plus `Set-Cookie` and `clearCookie()` responses
- redirects, binary responses and custom status/headers via `pipeResponse()`
- built-in error responses with `InternalPipeErr`, `BadRequestPipeErr`, `ValidationPipeErr`, `ContentTooLargePipeErr`, `TooManyRequestsPipeErr`, `UnauthorizedPipeErr`, `ForbiddenPipeErr`, and `RouteNotFoundPipeErr`
- CORS preflight support and a custom not-found handler
- an injected smoke test via `app.inject()` before the server is started

Run it with:

```bash
npm run run:example
```

Useful demo endpoints include:
- `/health`
- `/greet/:name`
- `/search?term=pipe&page=2`
- `/validated`
- `/upload`
- `/cookies`
- `/redirect`
- `/errors/:type`
- `/accounts/:id`

## Future work

Planned improvements and known limitations:
- add a global custom error handler API
- extend route methods to support `HEAD`, `OPTIONS`, and other HTTP verbs explicitly
- add Express-compatible middleware adapters
- support streaming request bodies instead of buffering all payloads in memory
- make CORS origin/headers configuration more flexible
- add more integration and unit tests for edge cases
- add websocket support

## License
MIT