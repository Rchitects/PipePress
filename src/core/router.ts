/*** imports ***/
import fastJSON from "fast-json-stringify";
import { parseAndValidateRequestStage } from "../stages/requestParser";
import type { HTTPMethod, PipeRouteHandler, PipeRouterConfig, PipeStage, Route, RouteOptions, stringyfy } from "./models";

/*** definition ***/
const DEFAULT_ROUTER_CONFIG: Required<PipeRouterConfig> = {
    maxBodyLength: 0
}

/*** class ***/
export class Router {
    /*** variables ***/
    protected _stages: PipeStage<any, any>[] = [];
    protected _routes: Route[] = [];
    protected _children: { prefix: string, router: Router }[] = [];
    protected _routerConfig: Required<PipeRouterConfig>;

    constructor(config: PipeRouterConfig = {}) {
        this._routerConfig = { ...DEFAULT_ROUTER_CONFIG, ...config };
    }

    /*** private functions ***/
    private _on(method: HTTPMethod, path: string, optionsOrHandler: RouteOptions, handler: PipeRouteHandler<any, any>): void {
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
            cookies: optionsOrHandler.cookies
        });
    }
    /*** public functions ***/
    // TODO: Typesafety
    // TODO: Improve stages defintion
    use<Res,State = {}>(stage: PipeStage<Res, State>): Router {
        this._stages.push(stage);
        return this;
    }

    mount(path: string, router: Router) {
        this._children.push({ prefix: path, router: router });
    }

    collectRoutes(prefix: string = '', inheritedStages: PipeStage<any, any>[] = []): Route[] {
        /* collect own routes */
        const routes: Route[] = this._routes.map((route) => {
            /* build route pipeline
                1) global / inherited stages
                2) router stages
                2) body parser
                3) route-stages
            **/
            const routeStages = [
                ...inheritedStages,
                ...this._stages,
                parseAndValidateRequestStage(route, { bodyLimit: this._routerConfig.maxBodyLength }),  // TODO: create one global body-parser stage (save memory)
                ...(route.stages || [])
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
            } as Route;
        });
        /* get sub routes */
        const inheritedStagesNext = [...inheritedStages, ...this._stages];
        for (const { prefix: subPrefix, router } of this._children) {
            routes.push(...router.collectRoutes(prefix + subPrefix, inheritedStagesNext));
        }

        return routes;
    }


    /*** public HTTP functions ***/
    get<State = {}>(path: string, handler: PipeRouteHandler<RouteOptions, State>): void;
    get<State = {}, Opts extends RouteOptions = RouteOptions>(path: string, options: Opts, handler: PipeRouteHandler<Opts, State>): void;
    get(path: string, optionsOrHandler: RouteOptions | PipeRouteHandler<any, any>, handler?: PipeRouteHandler<any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('GET', path, opts, hand!);
    }
    post<State = {}>(path: string, handler: PipeRouteHandler<RouteOptions, State>): void;
    post<State = {}, Opts extends RouteOptions = RouteOptions>(path: string, options: Opts, handler: PipeRouteHandler<Opts, State>): void;
    post(path: string, optionsOrHandler: RouteOptions | PipeRouteHandler<any, any>, handler?: PipeRouteHandler<any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('POST', path, opts, hand!);
    }
    put<State = {}>(path: string, handler: PipeRouteHandler<RouteOptions, State>): void;
    put<State = {}, Opts extends RouteOptions = RouteOptions>(path: string, options: Opts, handler: PipeRouteHandler<Opts, State>): void;
    put(path: string, optionsOrHandler: RouteOptions | PipeRouteHandler<any, any>, handler?: PipeRouteHandler<any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('PUT', path, opts, hand!);
    }
    patch<State = {}>(path: string, handler: PipeRouteHandler<RouteOptions, State>): void;
    patch<State = {}, Opts extends RouteOptions = RouteOptions>(path: string, options: Opts, handler: PipeRouteHandler<Opts, State>): void;
    patch(path: string, optionsOrHandler: RouteOptions | PipeRouteHandler<any, any>, handler?: PipeRouteHandler<any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('PATCH', path, opts, hand!);
    }
    delete<State = {}>(path: string, handler: PipeRouteHandler<RouteOptions, State>): void;
    delete<State = {}, Opts extends RouteOptions = RouteOptions>(path: string, options: Opts, handler: PipeRouteHandler<Opts, State>): void;
    delete(path: string, optionsOrHandler: RouteOptions | PipeRouteHandler<any, any>, handler?: PipeRouteHandler<any, any>) {
        const opts = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
        const hand = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        this._on('DELETE', path, opts, hand!);
    }

    // options(){} // TODO: needed?
    // head(){}    // TODO: needed?
}