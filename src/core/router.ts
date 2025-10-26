/*** imports ***/
import type { HTTPMethod, PipeRouteHandler, PipeStage, Route, RouteOptions } from "./types";

/*** class ***/
export class Router {
    /*** variables ***/
    protected _stages: PipeStage<any>[] = [];
    protected _routes: Route[] = [];
    protected _children: { prefix: string, router: Router }[] = [];

    /*** public functions ***/
    // TODO: Typesafety
    // TODO: Improve stages defintion
    use(stage: PipeStage<any>): Router {
        this._stages.push(stage);
        return this;
    }

    on(method: HTTPMethod, path: string, handler: PipeRouteHandler<any>): void;
    on(method: HTTPMethod, path: string, options: RouteOptions, handler: PipeRouteHandler<any>): void;
    on(method: HTTPMethod, path: string, optionsOrHandler: PipeRouteHandler<any> | RouteOptions, handler?: PipeRouteHandler<any>): void {
        if (typeof optionsOrHandler === 'function') {
            /* no options */
            this._routes.push({
                method: method,
                path: path,
                handler: optionsOrHandler as PipeRouteHandler<any>
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
        const combStages = [...inheritedStages, ...this._stages];

        /* collect own routes */
        const routes: Route[] = this._routes.map((route) => {
            return {
                method: route.method,
                path: prefix + route.path,
                handler: route.handler,
                stages: [...combStages, ...(route.stages || [])],
                body: route.body,
                serializer: route.serializer
            } as Route;
        });
        /* get sub routes */
        for (const { prefix: subPrefix, router } of this._children) {
            routes.push(...router.collectRoutes(prefix + subPrefix, combStages));
        }

        return routes;
    }


    /*** public HTTP functions ***/
    get(path: string, handler: PipeRouteHandler<any>): void;
    get(path: string, options: RouteOptions, handler: PipeRouteHandler<any>): void;
    get(path: string, optionsOrHandler: PipeRouteHandler<any> | RouteOptions, handler?: PipeRouteHandler<any>): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('GET', path, optionsOrHandler);
        }
        else {
            this.on('GET', path, optionsOrHandler, handler!);
        }
    }
    post(path: string, handler: PipeRouteHandler<any>): void;
    post(path: string, options: RouteOptions, handler: PipeRouteHandler<any>): void;
    post(path: string, optionsOrHandler: PipeRouteHandler<any> | RouteOptions, handler?: PipeRouteHandler<any>): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('POST', path, optionsOrHandler);
        }
        else {
            this.on('POST', path, optionsOrHandler, handler!);
        }
    }

    put(path: string, handler: PipeRouteHandler<any>): void;
    put(path: string, options: RouteOptions, handler: PipeRouteHandler<any>): void;
    put(path: string, optionsOrHandler: PipeRouteHandler<any> | RouteOptions, handler?: PipeRouteHandler<any>): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('PUT', path, optionsOrHandler);
        }
        else {
            this.on('PUT', path, optionsOrHandler, handler!);
        }
    }

    patch(path: string, handler: PipeRouteHandler<any>): void;
    patch(path: string, options: RouteOptions, handler: PipeRouteHandler<any>): void;
    patch(path: string, optionsOrHandler: PipeRouteHandler<any> | RouteOptions, handler?: PipeRouteHandler<any>): void {
        if (typeof optionsOrHandler === 'function') {
            this.on('PATCH', path, optionsOrHandler);
        }
        else {
            this.on('PATCH', path, optionsOrHandler, handler!);
        }
    }

    delete(path: string, handler: PipeRouteHandler<any>): void;
    delete(path: string, options: RouteOptions, handler: PipeRouteHandler<any>): void;
    delete(path: string, optionsOrHandler: PipeRouteHandler<any> | RouteOptions, handler?: PipeRouteHandler<any>): void {
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