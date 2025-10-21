import { PipePress } from "../src/core/pipepress";
import { Router } from "../src/core/router";

/*** router ***/
const router1 = new Router().use<{ user: string }>(async (ctx) => {

});

router1.on<any, any, any, { name: string }>('GET', '/test', async (ctx) => {
    
});

const router2 = new Router();
router2.post('/create', async (ctx) => { });
router2.get('/', async (ctx) => { });

router1.mount('/user', router2);

/*** pipepress ***/
const app = new PipePress();
app.get('/', async (ctx) => { });
app.mount('/api', router1 as any);


app.build();