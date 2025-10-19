# PipePress

PipePress is a high-performance, Express-inspired web framework that replaces traditional middleware call stacks with precompiled pipelines. It remains familiar to Express users while offering improved performance, modularity, and full TypeScript support.

## Features
- ⚡ Precompiled middleware pipelines
- 🧱 Global, router-level, and route-level middleware
- ✅ Express-compatible handler and middleware support
- 📦 Modular: body parser, CORS, error handling separated
- 🧠 TypeScript-first with type-safe request context
- 🛑 Centralized error and not-found handling

## Installation

```bash
npm install pipepress
```

## Quick Example

```ts
import { PipePress, defineRouter } from "pipepress";

const users = defineRouter()
  .use(async (ctx) => {
    console.log("User router middleware");
    return true;
  })
  .get("/:id", async (ctx) => {
    ctx.res.end("User ID: " + ctx.req.params.id);
  });

const app = new PipePress();

app.use(async () => true);

app.mount("/users", users);

app.build();

app.listen(3000, () => console.log("PipePress running at http://localhost:3000"));
```

## Error Handling

```ts
app.setErrorHandler((err, ctx) => {
  ctx.res.statusCode = err.status || 500;
  ctx.res.end(err.message || "Internal Server Error");
});

app.setNotFoundHandler((ctx) => {
  ctx.res.statusCode = 404;
  ctx.res.end("Not Found");
});
```

## Roadmap
- Type-safe context injection
- Request validation integration
- Express router auto-conversion
- WebSocket integration
- Plugin system (Auth, RateLimit, etc.)

## License
MIT
