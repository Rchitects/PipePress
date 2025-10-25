/*** imports ***/
import { PipePress, Router, PipeStage, pipeBodyParser } from "../src/index";

/*** pre-defined stages ***/
const logger: PipeStage<void> = {
    handler: async (ctx) => {
        if (ctx.body) {
            console.dir(ctx.body);
        }
        ctx.req.on('end', () => {
            console.log(`[${ctx.res.statusCode}] ${ctx.req.method} ${ctx.req.url}`);
        });
    }
}
/*** router ***/
/*** pipepress ***/
const app = new PipePress();

/* global stages */
app.use(pipeBodyParser({ isoDate: true }))
app.use(logger);

/* routes */
app.get('/error', {
    handler: async (ctx) => {
        throw new Error('WTF IS THIS');
    }
});

app.post('/data', {
    handler: async (ctx) => {
        return { status: 'IO', message: 'Created', ...ctx.body };
    }
})

/* router */
const router = new Router();
router.get('/:id', {
    handler: async (ctx) => {
        console.log('Get user with id ', ctx.params.id);
        return { name: 'Johnny', id: ctx.params.id, created: new Date() };
    }
})
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