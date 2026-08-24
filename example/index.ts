/*** imports (compiled) ***/
import {
    BadRequestPipeErr,
    basicHTTPLogger,
    ContentTooLargePipeErr,
    ForbiddenPipeErr,
    HTTPStatus,
    InternalPipeErr,
    PipePress,
    pipeResponse,
    rateLimiter,
    redirect,
    RouteNotFoundPipeErr,
    Router,
    setCookie,
    clearCookie,
    TooManyRequestsPipeErr,
    UnauthorizedPipeErr,
    ValidationPipeErr,
} from "../dist";
import dt from "../dist/core/datatypes";

function createDemoApp() {
    const app = new PipePress({
        cors: { preflight: 'auto' },
        maxBodyLength: 1_000_000,
    });

    app.use(basicHTTPLogger());
    app.use(rateLimiter({ maxTokens: 20, refillAmount: 1, refillIntervalMs: 1000 }));
    app.use({
        handler: async (ctx) => {
            ctx.res.setHeader('x-pipepress-demo', 'active');
        },
    });

    app.get('/health', async () => ({
        ok: true,
        message: 'PipePress is up',
        features: [
            'global stages',
            'schema validation',
            'cookies',
            'redirects',
            'file uploads',
            'custom errors',
            'app.inject()',
        ],
    }));

    app.get('/greet/:name', {
        params: dt.Object({ name: dt.String() }),
        response: dt.Object({
            greeting: dt.String(),
            name: dt.String(),
        }),
    }, async (ctx) => {
        return {
            greeting: `Hello ${ctx.params.name}!`,
            name: ctx.params.name,
        };
    });

    app.get('/search', {
        query: dt.Object({
            term: dt.String(),
            page: dt.Number().isOptional(),
        }),
    }, async (ctx) => {
        return {
            term: ctx.query.term,
            page: ctx.query.page ?? 1,
            message: 'Query validation and parsing worked',
        };
    });

    app.post('/validated', {
        body: dt.Object({
            name: dt.String(),
            age: dt.Number().isOptional(),
            role: dt.StringLiteral('admin', 'member').isOptional(),
        }),
        response: dt.Object({
            created: dt.Boolean(),
            payload: dt.Object({
                name: dt.String(),
                age: dt.Number().isOptional(),
                role: dt.StringLiteral('admin', 'member').isOptional(),
            }),
        }),
    }, async (ctx) => {
        return {
            created: true,
            payload: ctx.body,
        };
    });

    app.post('/upload', {
        files: {
            avatar: { required: true },
        },
        body: dt.Object({
            caption: dt.String().isOptional(),
        }),
        stages: [
            {
                handler: async (ctx) => {
                    console.log(`[demo] pre-parse stage for ${ctx.req.method} ${ctx.req.url}`);
                },
                runBeforeParse: true,
            },
            {
                handler: async (ctx) => {
                    console.log(`[demo] post-parse stage saw ${ctx.body ? 'body' : 'no body'}`);
                },
            },
        ],
    }, async (ctx) => {
        return {
            message: 'Upload received',
            body: ctx.body,
            files: ctx.files?.avatar?.map((file) => ({
                filename: file.filename,
                size: file.size,
                mimeType: file.mimeType,
            })),
        };
    });

    app.get('/cookies', {
        cookies: dt.Object({
            theme: dt.StringLiteral('dark', 'light').isOptional(),
        }),
    }, async (ctx) => {
        setCookie(ctx.res, 'demo', 'pipepress', { httpOnly: true, sameSite: 'Lax' });
        clearCookie(ctx.res, 'old-session');

        return {
            message: 'Cookies handled',
            receivedTheme: ctx.cookies?.theme ?? 'default',
            rawCookies: ctx.rawCookies,
        };
    });

    app.get('/redirect', async () => {
        return redirect('https://example.com');
    });

    app.get('/custom-response', async () => {
        return pipeResponse({
            status: HTTPStatus.CREATED,
            headers: { 'x-demo': 'custom-response' },
            cookies: [{ name: 'flash', value: 'done', httpOnly: true, path: '/' }],
            body: {
                message: 'Custom response with headers and cookies',
            },
        });
    });

    app.get('/binary', { contentType: 'image/gif' }, async () => {
        return Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    });

    app.get('/errors/:type', {
        params: dt.Object({
            type: dt.StringLiteral('bad', 'validation', 'too-large', 'rate-limit', 'auth', 'forbidden', 'not-found'),
        }),
    }, async (ctx) => {
        switch (ctx.params.type) {
            case 'bad':
                throw new BadRequestPipeErr('This is a deliberate BadRequestPipeErr');
            case 'validation':
                throw new ValidationPipeErr('This is a deliberate ValidationPipeErr');
            case 'too-large':
                throw new ContentTooLargePipeErr(1024, 2048);
            case 'rate-limit':
                throw new TooManyRequestsPipeErr(1000, 5, 6);
            case 'auth':
                throw new UnauthorizedPipeErr('Missing token');
            case 'forbidden':
                throw new ForbiddenPipeErr('Access denied');
            case 'not-found':
                throw new RouteNotFoundPipeErr(ctx.req.method as any, ctx.req.url || '/errors/not-found');
            default:
                throw new InternalPipeErr(new Error('Unexpected demo path'));
        }
    });

    type AccountState = { scope: string; requestPath: string };
    const accounts = new Router<AccountState>();
    accounts.use({
        handler: async (ctx, state) => {
            state.scope = 'accounts';
            state.requestPath = ctx.req.url || '/';
        },
    });
    accounts.get('/:id', {
        params: dt.Object({ id: dt.String() }),
        response: dt.Object({
            scope: dt.String(),
            requestPath: dt.String(),
            id: dt.String(),
        }),
    }, async (ctx, state) => {
        return {
            scope: state.scope,
            requestPath: state.requestPath,
            id: ctx.params.id,
        };
    });
    app.mount('/accounts', accounts);

    app.setNotFoundHandler<{ message: string; path: string }>(async (ctx) => {
        return pipeResponse({
            status: HTTPStatus.NOT_FOUND,
            body: {
                message: 'The requested resource was not found',
                path: ctx.req.url || '/',
            },
        });
    }, dt.Object({
        message: dt.String(),
        path: dt.String(),
    }));

    return app;
}

async function main() {
    const app = createDemoApp();
    app.build();

    console.log('PipePress demo routes:');
    console.log(app.prittyPrintRoutes());

    const smoke = await app.inject({
        method: 'GET',
        url: '/health',
    });

    console.log('Injected smoke test status:', smoke.statusCode);
    console.log('Injected smoke test body:', smoke.json());

    await app.listen(4000);
    console.log('Demo server listening on http://localhost:4000');

    process.on('SIGINT', async () => {
        await app.close();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await app.close();
        process.exit(0);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});