/*** imports (compiled) ***/
import { BadRequestPipeErr, basicHTTPLogger, HTTPStatus, InternalPipeErr, PipePress, pipeResponse, rateLimiter, redirect, RouteNotFoundPipeErr, ValidationPipeErr, ContentTooLargePipeErr, TooManyRequestsPipeErr, UnauthorizedPipeErr, ForbiddenPipeErr, Router, setCookie } from "../dist";
import dt, { Infer } from "../dist/core/datatypes";

/*** pre-defined stages ***/
/*** router ***/
/*** pipepress ***/
const app = new PipePress({
    // maxBodyLength: 100,
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
    const rand = Math.random() * 12;

    if (rand < 1) throw new Error('WTF IS THIS');
    if (rand < 2) throw new InternalPipeErr(new Error('INTRA LAN'));
    if (rand < 3) throw new BadRequestPipeErr('This request is bad');
    if (rand < 4) throw new ValidationPipeErr('Validation failed for demo');
    if (rand < 5) throw new ContentTooLargePipeErr(1024, 2048);
    if (rand < 6) throw new TooManyRequestsPipeErr(5000, 10, 11);
    if (rand < 7) throw new UnauthorizedPipeErr('Missing auth token');
    if (rand < 8) throw new ForbiddenPipeErr('Access denied');
    if (rand < 9) throw new RouteNotFoundPipeErr(ctx.req.method as any, ctx.req.url || '/error');

    return pipeResponse({
        status: HTTPStatus.OK,
        body: { message: 'No error thrown this time' }
    });
});

const resp1 = dt.Object({
    name: dt.String(),
    age: dt.Number(),
    birth: dt.Date().isOptional()
});
app.get('/birth', { response: resp1 }, async (ctx) => {
    return {
        age: 123,
        name: "John Doe"
    }
});

const dataBody = dt.Object({
    name: dt.String(),
    age: dt.Number().isOptional()
});
app.post('/data/:id', { body: dataBody, params: dt.Object({ id: dt.String() }) }, async (ctx) => {
    return { status: 'IO', message: 'Created', ...ctx.body };
});
app.post('/ping', async (ctx) => {
    return { ...(ctx.body || {}) };
});

/* router */
const router = new Router();
type Test = { test: string };
router.use({
    handler: async (ctx, state: Test) => {
        console.log('All user routes use this stage');
        state.test = 'Hello wordld';
    }
});
router.get('/:id', { params: dt.Object({ id: dt.String() }) }, async (ctx, state: Test) => {
    console.log('Get user with id ', ctx.params.id);
    console.log('Test value from higher stage:', state.test);
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

/* long route */
app.get('/slow', async (ctx) => {
    await new Promise((res) => setTimeout(res, 10000));
    return { status: 'OK', message: 'That was slow!' };
});

/* file upload */
app.post('/file-upload', {
    // files: {
    //     uno: { required: true },
    //     duo: { required: false }
    // },
    body: dt.Object({
        name: dt.String(),
        age: dt.Number().isOptional()
    }),
    stages: [
        { handler: (ctx) => console.log('Pefore parse', Date.now()), runBeforeParse: true },
        { handler: (ctx) => console.log('After parse', Date.now()) }
    ]
}, async (ctx) => {
    console.log('Files');
    console.log(ctx.files);
    // if (!ctx.files.uno) {
    //     console.log('No files uploaded');
    // }
    // else {
    //     console.log('Uno files Len', ctx.files.uno.length);
    //     console.log('File content');
    //     for (const file of ctx.files.uno) {
    //         console.log(file.filename, file.path);
    //     }
    // }
    if (ctx.body) {
        console.log('Body');
        console.log(ctx.body);
    }
    else {
        console.log('No Body');
    }
    console.log('Sleep for 1 sek');
    await new Promise((res, rej) => setTimeout(res, 1000));
    return {
        message: "Thanks Mr"
    };
});

/* random status */
app.get('/random-status', { response: dt.Object({ message: dt.String() }) }, async (ctx) => {

    const rand = Math.random() * 10;

    if (rand < 3) {
        // return pipeResponse({ status: HTTPStatus.FOUND, headers: { 'Location': 'https://google.com' } });
        return redirect('https://www.google.com');
    }
    if (rand < 8) {
        return pipeResponse({ status: HTTPStatus.BAD_REQUEST, body: { message: 'Bad request' } });
    }

    return { message: 'Random status worked' };
});

/* cookies */
app.get('/cookies', {
    query: dt.Object({ name: dt.String() }),
    cookies: dt.Object({ age: dt.Number() })
}, async (ctx) => {
    console.log(ctx.rawCookies);
    setCookie(ctx.res, 'Name', ctx.query.name, { maxAge: 100_000 });
    return { message: `Hallo ${ctx.query.name}! You are ${ctx.cookies.age}` };
});

/* params */
app.get('/params/none/:name', async (ctx) => {
    return { ...ctx.params };
});
app.get('/params/one/:id', { params: dt.Object({ id: dt.Number() }) }, async (ctx) => {
    return { ...ctx.params };
});
app.get('/params/:id/multi/:name', { params: dt.Object({ id: dt.Number(), name: dt.String() }) }, async (ctx) => {
    return { ...ctx.params };
});

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