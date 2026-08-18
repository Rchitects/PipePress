/*** imports ***/
import fastJSON from "fast-json-stringify";
import { BODY_LIMIT_DEFAULT, parseAndValidateRequestStage } from "../stages/requestParser";
import type { HTTPMethod, InferStateFromOpts, PipeRouteHandler, PipeRouterConfig, PipeStage, Route, RouteOptions, stringyfy } from "./models";
import { EventMap, Notifier } from "./eventNotifier";

/*** definition ***/
const DEFAULT_ROUTER_CONFIG: Required<PipeRouterConfig> = {
    maxBodyLength: BODY_LIMIT_DEFAULT
}

/*** class ***/
export class Router<GlobalState = {}, Events extends EventMap = {}> extends Notifier<Events> {
    /*** variables ***/
    protected _stages: PipeStage<any, any>[] = [];
    protected _routes: Route<any>[] = [];
    protected _children: { prefix: string, router: Router }[] = [];
    protected _routerConfig: Required<PipeRouterConfig>;

    constructor(config: PipeRouterConfig = {}) {
        super();
        this._routerConfig = { ...DEFAULT_ROUTER_CONFIG, ...config };
    }

    /*** private functions ***/
    private _on(method: HTTPMethod, path: string, optionsOrHandler: RouteOptions<any>, handler: PipeRouteHandler<any, any>): void {
        /* check for serialzier */
        let serializer: stringyfy<any> = JSON.stringify;
        if (optionsOrHandler.response) {
            const schema = optionsOrHandler.response.toJSONSchema();
            serializer = fastJSON(schema as any);   // fast-json-stringify types are equal to JSONSchema7 but defintion is diffrent
        }
        /* create route */
        this._routes.push({
            method: method,
            path: path,
            handler: handler!,
            stages: optionsOrHandler.stages,
            body: optionsOrHandler.body,
            serializer: serializer,
            contentType: optionsOrHandler.contentType,
            files: optionsOrHandler.files,
            params: optionsOrHandler.params,
            query: optionsOrHandler.query,
            cookies: optionsOrHandler.cookies,
            bodyLimit: optionsOrHandler.bodyLimit
        });
    }
    /*** public functions ***/
    // TODO: Typesafety
    // TODO: Improve stages defintion
    use<Res, State>(stage: PipeStage<Res, GlobalState & State>): Router<GlobalState & State> {
        this._stages.push(stage);
        return this;
    }

    mount(path: string, router: Router) {
        this._children.push({ prefix: path, router: router });
    }

    collectRoutes(prefix: string = '', inheritedStages: PipeStage<any, any>[] = []): Route<any>[] {
        /* collect own routes */
        const routes: Route<any>[] = this._routes.map((route) => {
            /* build route pipeline
                1) preParseStages
                2) parseRequestStage
                3) inheritedStages
                4) this router stages
                5) route-specfic stages
            **/
            const allStages = [
                ...inheritedStages,
                ...this._stages,
                ...(route.stages || [])
            ];
            const preParseStages = allStages.filter((stage) => stage.runBeforeParse);
            const postParseStages = allStages.filter((stage) => !stage.runBeforeParse);
            const routeStages = [
                ...preParseStages,
                parseAndValidateRequestStage(route, { bodyLimit: this._routerConfig.maxBodyLength }),  // TODO: create one global body-parser stage (save memory)
                ...postParseStages
            ];
            return {
                method: route.method,
                path: prefix + route.path,
                handler: route.handler,
                stages: routeStages,
                body: route.body,
                serializer: route.serializer,
                contentType: route.contentType,
                files: route.files,
                params: route.params,
                query: route.query
            } as Route<any>;
        });
        /* get sub routes */
        const inheritedStagesNext = [...inheritedStages, ...this._stages];
        for (const { prefix: subPrefix, router } of this._children) {
            routes.push(...router.collectRoutes(prefix + subPrefix, inheritedStagesNext));
        }

        return routes;
    }


    /*** public HTTP functions ***/
    // GET
    get<Path extends string, State = GlobalState>(path: Path, handler: PipeRouteHandler<Path, RouteOptions<Path>, State>): void;
    get<
        Path extends string,
        const Opts extends RouteOptions<Path>,
        State = GlobalState & InferStateFromOpts<Opts>,
    >(path: Path, options: Opts, handler: PipeRouteHandler<Path, Opts, State>): void;
    get(path: string, optionsOrHandler: RouteOptions<any> | PipeRouteHandler<any, any, any>, handler?: PipeRouteHandler<any, any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('GET', path, opts, hand!);
    }

    // POST
    post<Path extends string, State = GlobalState>(path: Path, handler: PipeRouteHandler<Path, RouteOptions<Path>, State>): void;
    post<
        Path extends string,
        const Opts extends RouteOptions<Path>,
        State = GlobalState & InferStateFromOpts<Opts>,
    >(path: Path, options: Opts, handler: PipeRouteHandler<Path, Opts, State>): void;
    post(path: string, optionsOrHandler: RouteOptions<any> | PipeRouteHandler<any, any, any>, handler?: PipeRouteHandler<any, any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('POST', path, opts, hand!);
    }

    // PUT
    put<Path extends string, State = GlobalState>(path: Path, handler: PipeRouteHandler<Path, RouteOptions<Path>, State>): void;
    put<
        Path extends string,
        const Opts extends RouteOptions<Path>,
        State = GlobalState & InferStateFromOpts<Opts>,
    >(path: Path, options: Opts, handler: PipeRouteHandler<Path, Opts, State>): void;
    put(path: string, optionsOrHandler: RouteOptions<any> | PipeRouteHandler<any, any, any>, handler?: PipeRouteHandler<any, any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('PUT', path, opts, hand!);
    }

    // PATCH
    patch<Path extends string, State = GlobalState>(path: Path, handler: PipeRouteHandler<Path, RouteOptions<Path>, State>): void;
    patch<
        Path extends string,
        const Opts extends RouteOptions<Path>,
        State = GlobalState & InferStateFromOpts<Opts>,
    >(path: Path, options: Opts, handler: PipeRouteHandler<Path, Opts, State>): void;
    patch(path: string, optionsOrHandler: RouteOptions<any> | PipeRouteHandler<any, any, any>, handler?: PipeRouteHandler<any, any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('PATCH', path, opts, hand!);
    }

    // DELETE
    delete<Path extends string, State = GlobalState>(path: Path, handler: PipeRouteHandler<Path, RouteOptions<Path>, State>): void;
    delete<
        Path extends string,
        const Opts extends RouteOptions<Path>,
        State = GlobalState & InferStateFromOpts<Opts>,
    >(path: Path, options: Opts, handler: PipeRouteHandler<Path, Opts, State>): void;
    delete(path: string, optionsOrHandler: RouteOptions<any> | PipeRouteHandler<any, any, any>, handler?: PipeRouteHandler<any, any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('DELETE', path, opts, hand!);
    }

    // options(){} // TODO: needed?
    // head(){}    // TODO: needed?
}