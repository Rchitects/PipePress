/*** imports (compiled) ***/
import { basicHTTPLogger, PipePress, PipeStage, Router } from "pipepress";
import dt from "pipepress/datatypes";

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
const app = new PipePress({
    maxBodyLength: 100,
    cors: {
        preflight: 'auto'
    }
});

/* global stages */
// app.use(logger);
app.use(basicHTTPLogger());

/* not found handler */
// app.setNotFoundHandler<{ message: string }>(async (ctx) => {
//     return {
//         status: 404,
//         body: { message: `The requested resource ${ctx.req.url} was not found` }
//     };
// }, dt.Object({ message: dt.String() }));

/* routes */
app.get('/error', async (ctx) => {
    throw new Error('WTF IS THIS');
});

const resp1 = dt.Object({
    name: dt.String(),
    age: dt.Number(),
    birth: dt.Date().isOptional()
});
app.get('/birth', { response: resp1 }, async (ctx) => {
    return {
        age: 123,
        name: 'Peter',
    }
});


const dataBody = dt.Object({
    name: dt.String(),
    age: dt.Number().isOptional()
});
app.post('/data', { body: dataBody }, async (ctx) => {
    return { status: 'IO', message: 'Created', ...ctx.body };
});
app.post('/ping', async (ctx) => {
    return { ...(ctx.body || {}) };
});

/* router */
const router = new Router();
router.use({ handler: async (ctx) => { console.log('All user routes use this stage') } });
router.get<any, any, { id: string }>('/:id', async (ctx) => {
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

console.log(app.prittyPrintRoutes());

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