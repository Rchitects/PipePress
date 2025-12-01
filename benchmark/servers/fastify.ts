import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: false });
app.register(cors);

const schema = {
    body: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    response: {
        200: {
            type: "object",
            properties: { message: { type: "string" } }
        }
    }
};

app.post<{ Body: { name: string } }>("/echo", { schema }, async (req, reply) => {
    return { message: `Hello ${req.body.name}` };
});

app.listen({ port: 3002 }, () => process.send!("Fastify listening on 3002"));