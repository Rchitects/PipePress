export interface UserRepo<User> {
    findBySub(sub: string): Promise<User | null>;
    createUser(userinfo: UserInfoClaims): Promise<User>;
}
export type OAuthConfigBase = {
    issList: string[]
}
export type OAuthConfigSimple = OAuthConfigBase & {
    userRepo?: undefined;
}
export type OAuthConfigWithUser<User> = OAuthConfigBase & {
    userRepo: UserRepo<User>
}
export type OAuthState = {
    userId: string;
    iss: string;
}
export type OpenIDConfig = {
    issuer: string;
    jwks_uri: string;
    authorization_endpoint: string;
    token_endpoint: string;
    userinfo_endpoint: string;
}
export type JWKSKey = {
    kid: string;
    kty: string;
    use: string;
    n?: string;
    e?: string;
    x5c?: string[];
}
export type JWKSConfig = {
    keys: JWKSKey[];
}
export type UserInfoClaims = {
    sub: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    middle_name?: string;
    preferred_username?: string;
    picture?: string;
}