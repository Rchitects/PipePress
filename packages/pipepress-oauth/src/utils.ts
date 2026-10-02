/*** imports ***/
import { createPublicKey, KeyObject } from "node:crypto";
import { JWKSConfig, OpenIDConfig, UserInfoClaims } from "./models.js";
import { IncomingMessage } from "node:http";
import { BadRequestPipeErr, UnauthorizedPipeErr } from "@rchitects/pipepress";

/*** types ***/
/*** definitions ***/
const ALLOWED_ISS: Set<string> = new Set();
const OICD_CFG: Map<string, OpenIDConfig> = new Map();
const KEY_CACHE: Map<string, KeyObject> = new Map();
const KEY_REFRESH_COOLDOWN_MS = 10 * 60 * 1000; // 10 mins
let keyLastRefreshAt = 0;

/*** functions ***/
export function isAllowedISS(iss: string): boolean {
    return ALLOWED_ISS.has(iss.toLowerCase());
}
export async function setupOAuthISS(issList: string[]) {
    /* add ISS to list a catch all JWKS */
    issList.forEach(s => ALLOWED_ISS.add(s.toLowerCase()));

    /* fetch JWKS urls of ALL iss */
    for (const iss of ALLOWED_ISS) {
        const curCfg = await fetchOpenidConfig(iss);
        if (curCfg.jwks_uri) OICD_CFG.set(iss, curCfg);
    }
    /* fetch all keys */
    await refreshKeyCache();
}
async function refreshKeyCache() {
    for (const oicdCfg of OICD_CFG.values()) {
        const jwksCfg = await fetchJWKSConfig(oicdCfg.jwks_uri);
        for (const key of jwksCfg.keys) {
            if (key.use !== 'sig') continue;

            const keyObj = createPublicKey({
                key: key,
                format: 'jwk'
            });
            KEY_CACHE.set(key.kid, keyObj);
        }
    }
}
async function fetchOpenidConfig(iss: string): Promise<OpenIDConfig> {
    const configRes = await fetch(`${iss}.well-known/openid-configuration`);
    if (!configRes.ok) throw new Error(`Failed to fetch OIDC config for ${iss}: ${configRes.status}`);

    return configRes.json() as Promise<OpenIDConfig>;
}
async function fetchJWKSConfig(jwksUri: string): Promise<JWKSConfig> {
    const configRes = await fetch(jwksUri);
    if (!configRes.ok) throw new Error(`Failed to fetch JWKS-config from ${jwksUri}: ${configRes.status}`);

    return configRes.json() as Promise<JWKSConfig>;
}
export function extractJWTToken(req: IncomingMessage): string {
    if (!req.headers.authorization) throw new BadRequestPipeErr('Authorization is missing');
    if (!req.headers.authorization.startsWith('Bearer ')) throw new BadRequestPipeErr('Invalid authorization header');
    const token = req.headers.authorization.split(' ')[1];    // 'Bearer <token>' -> ['Bearer',<token>]
    if (token.length === 0) throw new BadRequestPipeErr('Corrupt authorization header');
    return token;
};
export async function getPublicKey(kid: string): Promise<KeyObject> {
    // TODO: refresh if to old
    if (KEY_CACHE.has(kid)) {
        return KEY_CACHE.get(kid)!;
    }

    /* unknown key, try to refresh if CD is valid */
    const now = Date.now();
    const cooldownActive = (now - keyLastRefreshAt) < KEY_REFRESH_COOLDOWN_MS;

    if (cooldownActive) {
        /* still in CD, do not refresh */
        throw new Error(`Unknown kid "${kid}" - next refresh allowed in ${Math.ceil((KEY_REFRESH_COOLDOWN_MS - (now - keyLastRefreshAt)) / 1000)
            }s`);
    }
    
    keyLastRefreshAt = now;
    await refreshKeyCache();

    const key = KEY_CACHE.get(kid);
    if (!key) throw new Error(`Public key for kid "${kid}" not found after refresh`);

    /* found after refresh */
    return key;
}
export async function fetchUserinfo(iss: string, jwtToken: string): Promise<UserInfoClaims> {
    const oicdCfg = OICD_CFG.get(iss);
    if (!oicdCfg) throw new UnauthorizedPipeErr(`Failed to fetch userinfo: Unknown issuer ${iss}`);
    const res = await fetch(oicdCfg.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${jwtToken}` },
    });
    if (!res.ok) throw new UnauthorizedPipeErr('userinfo request failed');
    return res.json() as Promise<UserInfoClaims>;
}