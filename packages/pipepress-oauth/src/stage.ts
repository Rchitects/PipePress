/*** imports ***/
import { BadRequestPipeErr, ForbiddenPipeErr, PipeContext, PipeStage, UnauthorizedPipeErr } from "@rchitects/pipepress";
import JWT, { JwtPayload } from "jsonwebtoken";
import { KeyObject } from "node:crypto";
import { OAuthConfigWithUser, OAuthState, OAuthStateWithUser, ValidationResult } from "./models.js";
import { extractJWTToken, fetchUserinfo, getPublicKey, isAllowedISS } from "./utils.js";

/*** main function ***/
async function basicOAuthValidation(ctx: PipeContext<string, {}>): Promise<ValidationResult> {
    /* get JWT token */
    const jwtToken = extractJWTToken(ctx.req);
    const jwtTokenDec = JWT.decode(jwtToken, { complete: true });

    if (jwtTokenDec === null) throw new BadRequestPipeErr('Corrupt JWT token');
    if (!jwtTokenDec.header.kid) throw new BadRequestPipeErr('KID is missing in JWT');
    if (jwtTokenDec.header.alg !== 'RS256') throw new BadRequestPipeErr(`Unknown ALG in JWT header ${jwtTokenDec.header.alg}`);
    if (typeof jwtTokenDec.payload === 'string') throw new BadRequestPipeErr('JWT payload is corrupted');

    /* token is fine */
    const jwtPayload = jwtTokenDec.payload;

    /* verify content of payload */
    if (!jwtPayload.sub) throw new ForbiddenPipeErr('Corrupt JWT token: user missing');
    if (!jwtPayload.iss) throw new ForbiddenPipeErr('Corrupt JWT token: issuer missing');

    /* JWT include issuer -> try to find a matching issuer and verifiy */
    if (!isAllowedISS(jwtPayload.iss)) throw new UnauthorizedPipeErr('Unknown / invalid issuer for JWT');

    /* get public key from cache or refresh cache */
    let keyObj: KeyObject;
    try {
        keyObj = await getPublicKey(jwtTokenDec.header.kid);
    }
    catch (e) {
        if (e instanceof Error) {
            throw new UnauthorizedPipeErr(e.message);
        }
        throw e;
    }

    /* verify token */
    try {
        JWT.verify(jwtToken, keyObj);
    }
    catch (e) {
        if ((e instanceof JWT.TokenExpiredError) || (e instanceof JWT.JsonWebTokenError)) {
            throw new ForbiddenPipeErr(e.message);  // TODO: inlcude inner??
        }
        throw e;
    }

    return {
        iss: jwtPayload.iss,
        sub: jwtPayload.sub,
        jwtToken
    }
}

/*** simple oauth stage ***/
export const oauthStage: PipeStage<void, OAuthState> = {
    handler: async (ctx, state) => {
        const validationRes = await basicOAuthValidation(ctx);

        /* validation succesfull */
        state.iss = validationRes.iss;
        state.userId = validationRes.sub;
    }
}

/*** user oauth stage ***/
export function createOAuthStage<User>(config: OAuthConfigWithUser<User>): PipeStage<void, OAuthStateWithUser<User>> {
    /* create stage */
    return {
        handler: async (ctx, state) => {
            /* basic validation */
            const validationRes = await basicOAuthValidation(ctx);

            /*** full path with user lookup ***/
            let user = await config.userRepo.findBySub(validationRes.sub);

            if (!user) {
                const userInfo = await fetchUserinfo(validationRes.iss, validationRes.jwtToken);
                user = await config.userRepo.createUser(userInfo);
                // try {
                //     user = await config.userRepo.createUser(userInfo);
                // }
                // catch (err) {
                //     // TODO: race condition if two requets are parallel user might already created in parallel
                //     // in that case just lookup user again
                //     throw err;
                // }
            }

            /* extend context / state */
            state.userId = validationRes.sub;
            state.iss = validationRes.iss;
            state.user = user;
        }
    };
}