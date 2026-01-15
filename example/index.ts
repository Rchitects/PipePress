/*** imports (compiled) ***/
import { basicHTTPLogger, PipePress, PipeStage, rateLimiter, Router } from "../dist";
import dt from "../dist/core/datatypes";

/*** pre-defined stages ***/
/*** router ***/
/*** pipepress ***/
const app = new PipePress({
    maxBodyLength: 100,
    cors: {
        preflight: 'auto'
    }
});

/* global stages */
app.use(basicHTTPLogger());
app.use(rateLimiter());

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

/* custome conten type */
app.get('/image', { contentType: 'image/gif' }, async (ctx) => {
    const imgBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    ]);
    return imgBuffer;
});

/* crazy logger */
const loggi = (msg: string) => {
    console.log(`[CRAZY] ${msg}`);
};
app.get('/crazy-log', { stages: [basicHTTPLogger(loggi)] }, async (ctx) => { });

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