// import { generateKeyPairSync, KeyObject, randomUUID } from "node:crypto";
// import JWT from "jsonwebtoken";
// import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// import { BadRequestPipeErr, ForbiddenPipeErr, PipePress, UnauthorizedPipeErr, } from "@rchitects/pipepress";

// /*** mocks: nur die Außengrenzen (Token-Extraktion, Key-Lookup, Discovery) ***/
// const utils = vi.hoisted(() => ({
//     ALLOWED_ISS: new Set<string>(),
//     extractJWTToken: vi.fn<(req: unknown) => string>(),
//     getPublicKey: vi.fn<(kid: string) => Promise<KeyObject>>(),
//     getOidcUserinfoEndpoint: vi.fn<(iss: string) => Promise<{ userinfo_endpoint: string }>>(),
// }));
// vi.mock("./utils", () => utils);

// import { UserRepo, createOAuthStage } from "../src";

// /*** fixtures ***/
// const ISS = "https://auth.example.com/realms/test";
// const KID = "test-kid";
// const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
// const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

// interface TestUser { id: string; email?: string }

// function sign(
//     payload: Record<string, unknown> = {},
//     opts: { key?: KeyObject; kid?: string | null; alg?: JWT.Algorithm; expiresIn?: number } = {}
// ): string {
//     const { key = privateKey, kid = KID, alg = "RS256", expiresIn = 300 } = opts;
//     return JWT.sign({ sub: "user-1", iss: ISS, ...payload }, key, {
//         algorithm: alg,
//         expiresIn,
//         ...(kid ? { keyid: kid } : {}),
//     });
// }

// /** Führt den Handler aus und liefert das (mutierte) State-Objekt zurück. */
// async function run(stage: { handler: (ctx: any, state: any) => unknown }, token: string) {
//     utils.extractJWTToken.mockReturnValue(token);
//     const state: Record<string, unknown> = {};
//     await stage.handler({ req: {} }, state);
//     return state;
// }

// function makeRepo(overrides: Partial<UserRepo<TestUser>> = {}) {
//     return {
//         findBySub: vi.fn<UserRepo<TestUser>["findBySub"]>().mockResolvedValue(null),
//         createUser: vi
//             .fn<UserRepo<TestUser>["createUser"]>()
//             .mockImplementation(async (userinfo) => ({ id: randomUUID(), email: userinfo.email as string })),
//         ...overrides,
//     };
// }

// beforeEach(() => {
//     utils.ALLOWED_ISS.clear();
//     utils.ALLOWED_ISS.add(ISS.toLowerCase());
//     utils.getPublicKey.mockResolvedValue(publicKey);
//     utils.getOidcUserinfoEndpoint.mockResolvedValue({ userinfo_endpoint: "https://auth.example.com/userinfo" });
// });
// afterEach(() => {
//     vi.restoreAllMocks();
//     vi.clearAllMocks();
// });

// /*** Tests ***/
// describe("createOidcRoute - Token-Validierung (beide Pfade)", async () => {
//     const stage = await createOAuthStage({ issList: [ISS] })
//     it("lehnt kaputten Token ab (400)", async () => {
//         await expect(run(stage, "not-a-jwt")).rejects.toBeInstanceOf(BadRequestPipeErr);
//     });

//     it("lehnt Token ohne kid ab (400)", async () => {
//         await expect(run(stage, sign({}, { kid: null }))).rejects.toBeInstanceOf(BadRequestPipeErr);
//     });

//     it("lehnt andere Algorithmen als RS256 ab (400)", async () => {
//         const hs = JWT.sign({ sub: "u", iss: ISS }, "secret", { algorithm: "HS256", keyid: KID });
//         await expect(run(stage, hs)).rejects.toBeInstanceOf(BadRequestPipeErr);
//     });

//     it("lehnt Token ohne sub ab (403)", async () => {
//         const t = JWT.sign({ iss: ISS }, privateKey, { algorithm: "RS256", keyid: KID });
//         await expect(run(stage, t)).rejects.toBeInstanceOf(ForbiddenPipeErr);
//     });

//     it("lehnt Token ohne iss ab (403)", async () => {
//         const t = JWT.sign({ sub: "u" }, privateKey, { algorithm: "RS256", keyid: KID });
//         await expect(run(stage, t)).rejects.toBeInstanceOf(ForbiddenPipeErr);
//     });

//     it("lehnt unbekannten Issuer ab (401) und lädt keinen Key", async () => {
//         await expect(run(stage, sign({ iss: "https://evil.example.com" }))).rejects.toBeInstanceOf(UnauthorizedPipeErr);
//         expect(utils.getPublicKey).not.toHaveBeenCalled();
//     });

//     it("vergleicht den Issuer case-insensitiv (wie im Original)", async () => {
//         const state = await run(stage, sign({ iss: ISS.toUpperCase() }));
//         expect(state.userId).toBe("user-1");
//     });

//     it("übersetzt Fehler aus getPublicKey in 401", async () => {
//         utils.getPublicKey.mockRejectedValue(new Error("unknown kid"));
//         await expect(run(stage, sign())).rejects.toBeInstanceOf(UnauthorizedPipeErr);
//     });

//     it("lehnt falsche Signatur ab (403)", async () => {
//         await expect(run(stage, sign({}, { key: other.privateKey }))).rejects.toBeInstanceOf(ForbiddenPipeErr);
//     });

//     it("lehnt abgelaufenen Token ab (403)", async () => {
//         await expect(run(stage, sign({}, { expiresIn: -10 }))).rejects.toBeInstanceOf(ForbiddenPipeErr);
//     });
// });

// describe("createOidcRoute() – Fast Path (ohne userRepository)", () => {
//     it("setzt userId und iss, ohne userinfo-Call", async () => {
//         const fetchSpy = vi.spyOn(globalThis, "fetch");
//         const stage = await createOAuthStage({ issList: [ISS] });
//         const state = await run(stage, sign());
//         expect(state).toEqual({ userId: "user-1", iss: ISS });
//         expect(fetchSpy).not.toHaveBeenCalled();
//         expect(utils.getOidcUserinfoEndpoint).not.toHaveBeenCalled();
//     });
// });

// describe("createOidcRoute({ userRepository }) – Full Path", () => {
//     it("hängt bestehenden User an, ohne userinfo-Call", async () => {
//         const existing: TestUser = { id: "local-1" };
//         const repo = makeRepo({ findBySub: vi.fn().mockResolvedValue(existing) });
//         const fetchSpy = vi.spyOn(globalThis, "fetch");

//         const stage = await createOAuthStage({ issList: [ISS], userRepo: repo })
//         const state = await run(stage, sign());

//         expect(repo.findBySub).toHaveBeenCalledWith("user-1");
//         expect(state.user).toBe(existing);
//         expect(state.userId).toBe("user-1");
//         expect(fetchSpy).not.toHaveBeenCalled();
//         expect(repo.createUser).not.toHaveBeenCalled();
//     });

//     it("legt fehlenden User via userinfo an (Bearer-Token wird weitergereicht)", async () => {
//         const repo = makeRepo();
//         const token = sign();
//         const fetchSpy = vi
//             .spyOn(globalThis, "fetch")
//             .mockResolvedValue(new Response(JSON.stringify({ email: "a@b.de" }), { status: 200 }));

//         const state = await run(createOidcRoute({ userRepository: repo }), token);

//         expect(fetchSpy).toHaveBeenCalledWith("https://auth.example.com/userinfo", {
//             headers: { Authorization: `Bearer ${token}` },
//         });
//         expect(repo.createFromUserinfo).toHaveBeenCalledWith({
//             issuer: ISS,
//             sub: "user-1",
//             userinfo: { email: "a@b.de" },
//         });
//         expect(state.user).toEqual({ id: "local-user-1", email: "a@b.de" });
//     });

//     it("wirft 401, wenn userinfo fehlschlägt, und legt nichts an", async () => {
//         const repo = makeRepo();
//         vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));

//         await expect(run(createOidcRoute({ userRepository: repo }), sign())).rejects.toBeInstanceOf(UnauthorizedPipeErr);
//         expect(repo.createFromUserinfo).not.toHaveBeenCalled();
//     });

//     it("race condition: create schlägt fehl, zweiter Lookup findet den User", async () => {
//         const winner: TestUser = { id: "created-by-other-request" };
//         const repo = makeRepo({
//             findByIssuerAndSub: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(winner),
//             createFromUserinfo: vi.fn().mockRejectedValue(new Error("unique constraint")),
//         });
//         vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

//         const state = await run(createOidcRoute({ userRepository: repo }), sign());

//         expect(repo.findByIssuerAndSub).toHaveBeenCalledTimes(2);
//         expect(state.user).toBe(winner);
//     });

//     it("gibt den Create-Fehler weiter, wenn auch der zweite Lookup nichts findet", async () => {
//         const boom = new Error("db down");
//         const repo = makeRepo({ createFromUserinfo: vi.fn().mockRejectedValue(boom) });
//         vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

//         await expect(run(createOidcRoute({ userRepository: repo }), sign())).rejects.toBe(boom);
//     });

//     it("fasst das Repository bei ungültigem Token gar nicht an", async () => {
//         const repo = makeRepo();
//         await expect(run(createOidcRoute({ userRepository: repo }), sign({}, { key: other.privateKey }))).rejects.toBeInstanceOf(
//             ForbiddenPipeErr
//         );
//         expect(repo.findByIssuerAndSub).not.toHaveBeenCalled();
//     });
// });