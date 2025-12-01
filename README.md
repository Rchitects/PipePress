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
| 0       | express   | 5577.25 | 17.44   | 1.53 MB/s  | 124.12   |
| 1       | fastify   | 13421.6 | 6.83    | 2.87 MB/s  | 124.90   |
| 2       | nest      | 5006.11 | 19.5    | 1.40 MB/s  | 163.67   |
| 3       | pipepress | 17476.8 | 5.16    | 4.22 MB/s  | 78.70    |

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
