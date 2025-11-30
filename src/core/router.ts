/*** imports ***/
import { parseAndValidateBodyStage } from "../stages/bodyParser";
import type { HTTPMethod, PipeRouteHandler, PipeRouterConfig, PipeStage, Route, RouteOptions, stringyfy } from "./types";
import { DataType } from "./datatypes";
import fastJSON from "fast-json-stringify";

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

    on(method: HTTPMethod, path: string, handler: PipeRouteHandler<any, any, any, any>): void;
    on(method: HTTPMethod, path: string, options: RouteOptions<any, any>, handler: PipeRouteHandler<any, any, any, any>): void;
    on(method: HTTPMethod, path: string, optionsOrHandler: PipeRouteHandler<any, any, any> | RouteOptions<any, any>, handler?: PipeRouteHandler<any, any, any, any>): void {
        if (typeof optionsOrHandler === 'function') {
            /* no options */
            this._routes.push({
                method: method,
                path: path,
                handler: optionsOrHandler,
                serializer: JSON.stringify  // basic stringify
            });
        }
        else {
            /* with options */
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
                serializer: serializer
            });
        }
    }
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
    get<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    get<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        options: RouteOptions<Res, B>,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    get<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        optionsOrHandler: RouteOptions<Res, B> | PipeRouteHandler<Res, B, P, Q>,
        handler?: PipeRouteHandler<Res, B, P, Q>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('GET', path, optionsOrHandler);
        }
        else {
            this.on('GET', path, optionsOrHandler, handler!);
        }
    }

    post<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    post<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        options: RouteOptions<Res, B>,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    post<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        optionsOrHandler: RouteOptions<Res, B> | PipeRouteHandler<Res, B, P, Q>,
        handler?: PipeRouteHandler<Res, B, P, Q>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('POST', path, optionsOrHandler);
        }
        else {
            this.on('POST', path, optionsOrHandler, handler!);
        }
    }

    put<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    put<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        options: RouteOptions<Res, B>,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    put<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        optionsOrHandler: RouteOptions<Res, B> | PipeRouteHandler<Res, B, P, Q>,
        handler?: PipeRouteHandler<Res, B, P, Q>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('PUT', path, optionsOrHandler);
        }
        else {
            this.on('PUT', path, optionsOrHandler, handler!);
        }
    }

    patch<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    patch<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        options: RouteOptions<Res, B>,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    patch<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        optionsOrHandler: RouteOptions<Res, B> | PipeRouteHandler<Res, B, P, Q>,
        handler?: PipeRouteHandler<Res, B, P, Q>
    ): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('PATCH', path, optionsOrHandler);
        }
        else {
            this.on('PATCH', path, optionsOrHandler, handler!);
        }
    }

    delete<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    delete<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        options: RouteOptions<Res, B>,
        handler: PipeRouteHandler<Res, B, P, Q>
    ): void;
    delete<
        Res = any,
        B extends DataType<any, boolean> | undefined = undefined,
        P = undefined,
        Q = undefined
    >(
        path: string,
        optionsOrHandler: RouteOptions<Res, B> | PipeRouteHandler<Res, B, P, Q>,
        handler?: PipeRouteHandler<Res, B, P, Q>
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