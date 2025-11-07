/*** imports ***/
import { parseAndValidateBodyStage } from "../stages/bodyParser";
import type { HTTPMethod, Params, PipeRouteHandler, PipeRouterConfig, PipeStage, Route, RouteOptions } from "./types";
import { ParsedType, ValidatorType } from "./validation";

/*** definition ***/
const DEFAULT_ROUTER_CONFIG: Required<PipeRouterConfig> = {
    maxBodyLength: 0
}

/*** class ***/
export class Router {
    /*** variables ***/
    protected _stages: PipeStage<any>[] = [];
    protected _routes: Route[] = [];
    protected _children: { prefix: string, router: Router }[] = [];
    protected _routerConfig: Required<PipeRouterConfig>;

    constructor(config: PipeRouterConfig = {}) {
        this._routerConfig = { ...DEFAULT_ROUTER_CONFIG, ...config };
    }

    /*** public functions ***/
    // TODO: Typesafety
    // TODO: Improve stages defintion
    use(stage: PipeStage<any>): Router {
        this._stages.push(stage);
        return this;
    }

    on(method: HTTPMethod, path: string, handler: PipeRouteHandler<any, any, any>): void;
    on(method: HTTPMethod, path: string, options: RouteOptions<any>, handler: PipeRouteHandler<any, any, any>): void;
    on(method: HTTPMethod, path: string, optionsOrHandler: PipeRouteHandler<any, any, any> | RouteOptions<any>, handler?: PipeRouteHandler<any, any, any>): void {
        if (typeof optionsOrHandler === 'function') {
            /* no options */
            this._routes.push({
                method: method,
                path: path,
                handler: optionsOrHandler as PipeRouteHandler<any, any, any>
            });
        }
        else {
            /* with options */
            this._routes.push({
                method: method,
                path: path,
                handler: handler!,
                stages: optionsOrHandler.stages,
                body: optionsOrHandler.body,
                serializer: optionsOrHandler.serializer
            });
        }
    }
    // TODO: Typesafety
    mount(path: string, router: Router) {
        this._children.push({ prefix: path, router: router });
    }

    collectRoutes(prefix: string = '', inheritedStages: PipeStage<any>[] = []): Route[] {
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
                parseAndValidateBodyStage(route, { limit: this._routerConfig.maxBodyLength }),
                ...(route.stages || [])
            ];
            return {
                method: route.method,
                path: prefix + route.path,
                handler: route.handler,
                stages: routeStages,
                body: route.body,
                serializer: route.serializer
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
    get<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    get<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        options: RouteOptions<B>,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    get<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        optionsOrHandler: RouteOptions<B> | PipeRouteHandler<{ body: ParsedType<B> }, Res, P>,
        handler?: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('GET', path, optionsOrHandler);
        }
        else {
            this.on('GET', path, optionsOrHandler, handler!);
        }
    }
    post<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    post<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        options: RouteOptions<B>,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    post<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        optionsOrHandler: RouteOptions<B> | PipeRouteHandler<{ body: ParsedType<B> }, Res, P>,
        handler?: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('POST', path, optionsOrHandler);
        }
        else {
            this.on('POST', path, optionsOrHandler, handler!);
        }
    }

    put<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    put<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        options: RouteOptions<B>,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    put<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        optionsOrHandler: RouteOptions<B> | PipeRouteHandler<{ body: ParsedType<B> }, Res, P>,
        handler?: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('PUT', path, optionsOrHandler);
        }
        else {
            this.on('PUT', path, optionsOrHandler, handler!);
        }
    }

    patch<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    patch<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        options: RouteOptions<B>,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    patch<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        optionsOrHandler: RouteOptions<B> | PipeRouteHandler<{ body: ParsedType<B> }, Res, P>,
        handler?: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('PATCH', path, optionsOrHandler);
        }
        else {
            this.on('PATCH', path, optionsOrHandler, handler!);
        }
    }

    delete<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    delete<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        options: RouteOptions<B>,
        handler: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void;
    delete<B extends ValidatorType<any, boolean> | undefined, Res = any, P extends Params = any>(
        path: string,
        optionsOrHandler: RouteOptions<B> | PipeRouteHandler<{ body: ParsedType<B> }, Res, P>,
        handler?: PipeRouteHandler<{ body: ParsedType<B> }, Res, P>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('DELETE', path, optionsOrHandler);
        }
        else {
            this.on('DELETE', path, optionsOrHandler, handler!);
        }
    }
    // options(){} // TODO: needed?
    // head(){}    // TODO: needed?
}