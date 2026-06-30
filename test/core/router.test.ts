import { describe, it, expectTypeOf } from "vitest";
import { Router } from "../../src/core/router";

describe("Router route method generics", () => {
    it("infers path params for POST, PUT, PATCH and DELETE handlers", () => {
        const router = new Router();

        router.post("/users/:userId", (ctx) => {
            expectTypeOf(ctx.params).toEqualTypeOf<{ userId: string }>();
        });

        router.put("/users/:userId", (ctx) => {
            expectTypeOf(ctx.params).toEqualTypeOf<{ userId: string }>();
        });

        router.patch("/users/:userId", (ctx) => {
            expectTypeOf(ctx.params).toEqualTypeOf<{ userId: string }>();
        });

        router.delete("/users/:userId", (ctx) => {
            expectTypeOf(ctx.params).toEqualTypeOf<{ userId: string }>();
        });
    });
});
