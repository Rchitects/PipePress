/*** imports (compiled) ***/
import { PipePress, PipeStage, Router } from "pipepress";
import val from "pipepress/validation";

/*** pre-defined stages ***/
const logger: PipeStage<void> = {
    handler: async (ctx) => {
        ctx.res.on('finish', () => {
            let msg = `[${ctx.res.statusCode}] ${ctx.req.method} ${ctx.req.url} `;
            if (ctx.query) {
                msg += Object.entries(ctx.query).map(([key, value]) => {
                    return `${key} = ${value}`;
                }).join(',');
            }
            console.log(msg);
        })
    }
}
/*** router ***/
/*** pipepress ***/
const app = new PipePress({ maxBodyLength: 100 });

/* global stages */
app.use(logger);

/* routes */
app.get('/error', async (ctx) => {
    throw new Error('WTF IS THIS');
});

app.post('/data', { body: val.Object().of({ name: val.String(), age: val.Number().isOptional() }) }, async (ctx) => {
    return { status: 'IO', message: 'Created', ...ctx.body };
});
app.post('/ping', { body: val.Object().isOptional() }, async (ctx) => {
    return { ...(ctx.body || {}) };
});

/* router */
const router = new Router();
router.use({ handler: async (ctx) => { console.log('All user routes use this stage') } });
router.get('/:id', async (ctx) => {
    console.log('Get user with id ', ctx.params.id);
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

/* create routes */
app.build();

/* start server */
app.listen(4000)
    .then(() => {
        console.log('Running');
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });


process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
});