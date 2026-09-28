/*** imports ***/
import { PipeStage, BadRequestPipeErr, ForbiddenPipeErr, UnauthorizedPipeErr } from "@rchitects/pipepress";
import { OAuthConfigSimple, OAuthConfigWithUser, OAuthState } from "./models.js";
import { extractJWTToken, fetchUserinfo, getPublicKey, isAllowedISS, setupOAuthISS } from "./utils.js";
import JWT, { JwtPayload } from "jsonwebtoken";
import { KeyObject } from "node:crypto";

/*** main function ***/
export async function createOAuthStage(config: OAuthConfigSimple): Promise<PipeStage<void, OAuthState>>;
export async function createOAuthStage<User>(config: OAuthConfigWithUser<User>): Promise<PipeStage<void, OAuthState & { user: User }>>;
export async function createOAuthStage<User>(
    config: OAuthConfigSimple | OAuthConfigWithUser<User>
): Promise<
    PipeStage<void, OAuthState> |
    PipeStage<void, OAuthState & { user: User }>
> {
    /* setup oauth config when stage is created */
    await setupOAuthISS(config.issList);

    /* create stage */
    return {
        handler: async (ctx, state) => {
            /* define payload */
            let jwtPayload: JwtPayload;

            /* get JWT token */
            const jwtToken = extractJWTToken(ctx.req);
            const jwtTokenDec = JWT.decode(jwtToken, { complete: true });

            if (jwtTokenDec === null) throw new BadRequestPipeErr('Corrupt JWT token');
            if (!jwtTokenDec.header.kid) throw new BadRequestPipeErr('KID is missing in JWT');
            if (jwtTokenDec.header.alg !== 'RS256') throw new BadRequestPipeErr(`Unknown ALG in JWT header ${jwtTokenDec.header.alg}`);
            if (typeof jwtTokenDec.payload === 'string') throw new BadRequestPipeErr('JWT payload is corrupted');

            /* token is fine */
            jwtPayload = jwtTokenDec.payload;

            /* verify content of payload */
            if (!jwtPayload.sub) throw new ForbiddenPipeErr('Corrupt JWT token: user missing');
            if (!jwtPayload.iss) throw new ForbiddenPipeErr('Corrupt JWT token: issuer missing');

            /* extract data */
            const sub = jwtPayload.sub;
            const iss = jwtPayload.iss;

            /* JWT include issuer -> try to find a matching issuer and verifiy */
            if (!isAllowedISS(iss)) throw new UnauthorizedPipeErr('Unknown / invalid issuer for JWT');

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

            /* extend context */
            state.userId = sub;
            state.iss = iss;

            /* stop if just simple stage */
            if (!config.userRepo) return;

            /*** full path with user lookup ***/
            let user = await config.userRepo.findBySub(sub);

            if (!user) {
                const userInfo = await fetchUserinfo(iss, jwtToken);

                try {
                    user = await config.userRepo.createUser(userInfo);
                }
                catch (err) {
                    // TODO: race condition if two requets are parallel user might already created in parallel
                    // in that case just lookup user again
                    throw err;
                }
            }

            /* save user into state */
            (state as OAuthState & { user: User }).user = user;
        }
    } as PipeStage<void, OAuthState>
}