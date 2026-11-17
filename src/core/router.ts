/*** imports ***/
import fastJSON, { Schema } from "fast-json-stringify";
import { BODY_LIMIT_DEFAULT, parseAndValidateRequestStage } from "../stages/requestParser.js";
import { EventMap, Notifier } from "./eventNotifier.js";
import type { AnyPipeStage, AnyRoute, EmptyState, HTTPMethod, InferStateFromOpts, PipeRouteHandler, PipeRouterConfig, PipeStage, Route, RouteOptions, Simplify, stringyfy } from "./models.js";

/*** types ***/
interface RouteMethod<G extends object> {
    <Path extends string>(
        path: Path,
        handler: PipeRouteHandler<Path, RouteOptions<Path>, G>
    ): void;
    <Path extends string, const Opts extends RouteOptions<Path>>(
        path: Path,
        options: Opts,
        handler: PipeRouteHandler<Path, Opts, Simplify<G & InferStateFromOpts<Opts>>>
    ): void;
}

/*** definition ***/
const DEFAULT_ROUTER_CONFIG: Required<PipeRouterConfig> = {
    maxBodyLength: BODY_LIMIT_DEFAULT
}

/*** class ***/
export class Router<GlobalState extends object = EmptyState, Events extends EventMap = EventMap> extends Notifier<Events> {
    /*** variables ***/
    protected _stages: AnyPipeStage[] = [];
    protected _routes: AnyRoute[] = [];
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
            serializer = fastJSON(schema as Schema);   // fast-json-stringify types are equal to JSONSchema7 but defintion is diffrent
        }
        /* create route */
        this._routes.push({
            method: method,
            path: path,
            handler: handler,
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
    private _route(method: HTTPMethod): RouteMethod<GlobalState> {
        return ((
            path: string,
            optionsOrHandler: RouteOptions<any> | PipeRouteHandler<any, any, any>,
            handler?: PipeRouteHandler<any, any, any>
        ) => {
            const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
            const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
            this._on(method, path, opts, hand!);
        }) as RouteMethod<GlobalState>;
    }
    /*** public functions ***/
    use<Res, State extends object = EmptyState>(stage: PipeStage<Res, State>)
        : Router<Simplify<GlobalState & State>, Events> {
        this._stages.push(stage);
        return this as unknown as Router<Simplify<GlobalState & State>, Events>;
    }

    mount(path: string, router: Router<any, any>) {
        this._children.push({ prefix: path, router: router });
    }

    collectRoutes(prefix: string = '', inheritedStages: PipeStage<any, any>[] = []): Route<string>[] {
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
                query: route.query,
                cookies: route.cookies,
                bodyLimit: route.bodyLimit
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
    get = this._route('GET');
    post = this._route('POST');
    put = this._route('PUT');
    patch = this._route('PATCH');
    delete = this._route('DELETE');

    // options(){} // TODO: needed?
    // head(){}    // TODO: needed?
}