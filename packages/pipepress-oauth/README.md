# @rchitects/pipepress-oauth

OAuth/JWT verification stage for PipePress applications.

This package validates bearer tokens against configured OpenID Connect issuers, checks the JWT signature against the issuer JWKS, and optionally resolves a local user record from a repository.

## Features

- Verifies bearer JWTs against configured issuers
- Validates JWT structure, `kid`, and `alg`
- Requires `RS256` signatures
- Enforces an allow-list of issuers
- Fetches and caches OIDC discovery and JWKS data
- Optionally resolves a local user via `userRepo`
- Exposes verified identity data in PipePress stage state

## Installation

```bash
npm install @rchitects/pipepress @rchitects/pipepress-oauth
```

## Setup

The package does not take `issList` directly in the stage config. Instead, call `setupOAuthISS()` once during application startup so the allowed issuers and JWKS metadata are loaded and cached.

```ts
import { PipePress, Router } from "@rchitects/pipepress";
import { createOAuthStage, oauthStage, setupOAuthISS } from "@rchitects/pipepress-oauth";

await setupOAuthISS([
  "https://auth.example.com/realms/my-app",
]);
```

The issuer list is normalized case-insensitively and each configured issuer must expose an OIDC discovery document at:

```txt
{issuer}.well-known/openid-configuration
```

The library reads the `jwks_uri` from that document and fetches the active signing keys.

## Basic stage

If you only need the verified identity metadata, mount the built-in `oauthStage`.

```ts
import { PipePress, Router } from "@rchitects/pipepress";
import { oauthStage, setupOAuthISS } from "@rchitects/pipepress-oauth";

await setupOAuthISS(["https://auth.example.com/realms/my-app"]);

const app = new PipePress();
const api = new Router();

api.use(oauthStage);

api.get("/me", async (_ctx, state) => ({
  userId: state.userId,
  iss: state.iss,
}));

app.mount("/api", api);
app.build();
await app.listen(4000);
```

This stage sets the following state:

```ts
{
  userId: string;
  iss: string;
}
```

## Stage with local user lookup

For automatic user resolution, use `createOAuthStage()` with a `userRepo`.

```ts
import { PipePress, Router } from "@rchitects/pipepress";
import { createOAuthStage, setupOAuthISS } from "@rchitects/pipepress-oauth";

await setupOAuthISS(["https://auth.example.com/realms/my-app"]);

const app = new PipePress();
const api = new Router();

const oauth = createOAuthStage({
  userRepo: {
    async findBySub(sub) {
      return await db.users.findOne({ sub });
    },
    async createUser(userinfo) {
      return await db.users.create({
        sub: userinfo.sub,
        name: userinfo.name,
      });
    },
  },
});

api.use(oauth);

api.get("/me", async (_ctx, state) => ({
  userId: state.userId,
  iss: state.iss,
  user: state.user,
}));

app.mount("/api", api);
app.build();
await app.listen(4000);
```

The returned state is:

```ts
{
  userId: string;
  iss: string;
  user: User;
}
```

When `findBySub()` returns `null`, the stage fetches user info from the issuer and calls `createUser(userinfo)` before attaching the user to the state.

## User repository contract

```ts
export interface UserRepo<User> {
  findBySub(sub: string): Promise<User | null>;
  createUser(userinfo: UserInfoClaims): Promise<User>;
}
```

```ts
export type UserInfoClaims = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  preferred_username?: string;
  picture?: string;
};
```

## Validation behavior

The stage reads the `Authorization` header, expects a Bearer token, and validates:

- token format
- presence of `kid`
- algorithm is `RS256`
- `sub` and `iss` are present in the payload
- issuer is allowed by the configured `setupOAuthISS()` list
- signature matches the current public key for the issuer
- token is not expired or otherwise invalid

## Error behavior

The stage raises PipePress HTTP errors when validation fails:

- `BadRequestPipeErr` for malformed token or header issues
- `ForbiddenPipeErr` for invalid token claims or verification failures
- `UnauthorizedPipeErr` for unknown issuers or failed key/userinfo resolution

## Notes

- The package expects the upstream PipePress framework to be installed as a peer dependency.
- Only `RS256` tokens are accepted.
- Tokens must be sent using the standard Bearer authorization format.
- `setupOAuthISS()` should be called once during startup before the stage is used.
- The stage can be mounted as a global stage or router-local stage depending on the application structure.
