import { PipePress } from "../src/core/pipepress";
import { Router } from "../src/core/router";
import { BaseCtx } from "../src/core/types";

/*** router ***/
const router1 = new Router().use<{ user: string }>(async (ctx) => {

});

router1.on<any, any, any, { name: string }>('GET', '/test', async (ctx) => {

});

const router2 = new Router();
router2.post('/create', async (ctx) => { });
router2.get('/', async (ctx: BaseCtx) => { });

router1.mount('/user', router2);

/*** pipepress ***/
const app = new PipePress();
app.get('/', async (ctx: BaseCtx) => {
    ctx.res.statusCode = 200;
    ctx.res.end('All fine!');
});
app.mount('/api', router1 as any);

app.build();

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