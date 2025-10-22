import { PipePress } from '../src/core/pipepress';
import { Router } from '../src/core/router';
import { PipeStage } from '../src/core/types';

/*** pre-defined stages ***/
const logger: PipeStage<void> = {
    handler: async (ctx) => {
        ctx.req.on('end', () => {
            console.log(`[${ctx.res.statusCode}] ${ctx.req.method} ${ctx.req.url}`);
        });
    }
}
/*** router ***/
const router1 = new Router();
router1.use({
    handler: async (ctx) => {
        console.log('user stage')
    }
});
router1.get('/', {
    handler: async (ctx) => {
        console.log('GET /user')
    }
});

/*** pipepress ***/
const app = new PipePress();

app.use(logger);
app.use({
    handler: async (ctx) => {
        console.log('Global Stage');
    }
});

app.get('/', {
    handler: async (ctx) => {
        console.log('GET /')
    },
});
app.get('/data',
    {
        handler: async (ctx) => {
            return {
                name: 'Penis',
                id: 123321
            }
        },
    },
    {
        handler: async (ctx) => {
            console.log('/data stage');
        }
    }
);
app.get('/error', {
    handler: async (ctx) => {
        throw new Error('WTF IS THIS');
    }
});
app.mount('/user', router1);

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