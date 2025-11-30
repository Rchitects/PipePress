# PipePress

PipePress is a high-performance, Express-inspired web framework that replaces traditional middleware (stages) call stacks with precompiled pipelines. It remains familiar to Express users while offering improved performance, modularity, and full TypeScript support.

## Features
- ⚡ Precompiled stage pipelines
- 🧱 Global, router-level, and route-level stages
- 📦 Integrated features: body-validation & -parser / CORS
- 🚗 Super fast schema-based response serialization (JSON)
- 🧠 TypeScript-first with type-safe request context (query, params & body)
- 🛑 Centralized error and not-found handling

## Installation

```bash
npm install pipepress
```

## Benchmark

TODO
```bash
npm run benchmark
```
| (index) | name      | rps     | latency | throughput | memoryMB |
|---------|-----------|---------|---------|------------|----------|
| 0       | express   | 1557.25 | 2493.67 | 0.43 MB/s  | 44.80    |
| 1       | fastify   | 1714.25 | 2482.22 | 0.37 MB/s  | 45.82    |
| 2       | nest      | 0       | 0       | 0.00 MB/s  | 69.09    |
| 3       | pipepress | 3045    | 32.33   | 0.73 MB/s  | 59.83    |

## Quick Example
```ts
import { PipePress } from "pipepress";

const app = new PipePress();

/* global stages */
app.use(logger);

/* router */
const router = new Router();
router.use({ handler: async (ctx) => { console.log('All user routes use this stage') } });
router.get<any, any, { id: string }>('/:id', async (ctx) => {
    return { name: 'Johnny', id: ctx.params.id, created: new Date() };
});
router.get('/all', {
    stages: [{
        handler: async (ctx) => { console.log('Get all users private stage') }
    }]
}, async (ctx) => {
    return {
        users: [
            { name: 'Johnny', id: '1', created: new Date() },
            { name: 'Bob', id: '2', created: new Date() }
        ]
    };
});
app.mount('/user', router);

app.build();

app.listen(4000)
    .then(() => {
        console.log("PipePress running at http://localhost:3000")
    });
```

## Error Handling
TODO
```ts
app.setErrorHandler((err, ctx) => {
  ctx.res.statusCode = err.status || 500;
  ctx.res.end(err.message || "Internal Server Error");
});


/* custome not-found handler */
app.setNotFoundHandler(...);
```

## Roadmap
- Express-compatible handler and middleware support
- Type-safe context injection
- Express router auto-conversion
- WebSocket integration

## License
MIT
