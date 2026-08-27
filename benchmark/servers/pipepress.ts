import { PipePress } from "../../dist";
import dt from "../../dist/core/datatypes";

const app = new PipePress({ cors: { preflight: 'auto' } });
const port = process.env.PORT || '3004';

const schemaReq = dt.Object({ name: dt.String() });
const schemaResp = dt.Object({ message: dt.String() });

app.post("/echo", { body: schemaReq, response: schemaResp }, async (ctx) => {
    return { message: `Hello ${ctx.body.name}` };
});

app.build();
app.listen(+port)
    .then(() => {
        process.send?.("PipePress listening on " + port);
    });