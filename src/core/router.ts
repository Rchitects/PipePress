/*** imports ***/
import type { BaseCtx, HTTPMethod, Stage, Route, RouterOptions, ExtendedCtx } from "./types";

/*** defintions ***/

/*** class ***/
export class Router<RCtx extends BaseCtx = BaseCtx> {
    /*** variables ***/
    public prefix: string;
    private _stages: Stage<RCtx>[] = [];
    private _routes: Route<RCtx>[] = [];
    private _children: Router<RCtx>[] = [];

    /*** constructor ***/
    constructor(options?: RouterOptions) {
        this.prefix = options?.prefix ?? '';
    }

    /*** public functions ***/
    // TODO: create overright to handle sub-router & stages
    use<Extra = {}>(stage: Stage<ExtendedCtx<RCtx, Extra>>): Router<ExtendedCtx<RCtx, Extra>> {
        // TODO: make this cleaner without any
        this._stages.push(stage as any);
        return this as any;
    }

    on<
        Body = any,
        Query = any,
        Params = any,
        Extra = {}
    >(method: HTTPMethod, path: string, ...stages: Stage<ExtendedCtx<RCtx, BaseCtx<Body, Query, Params, Extra>>>[]) {
        /* extract last middle as main handler */
        // TODO: make this cleaner (Typesafety)
        const finalHandler = stages.pop() as unknown as Stage<RCtx>;
        const rest = stages as unknown as Stage<RCtx>[];

        this._routes.push({
            method,
            path,
            handler: finalHandler,
            stages: rest
        });
    }
    // TODO: Typesafety
    mount(path: string, router: Router<RCtx>) {
        router.prefix = path;
        this._children.push(router);
    }

    collectRoutes(prefix: string = '', inheritedStages: Stage<RCtx>[] = []): Route<RCtx>[] {
        const combStages = [...inheritedStages, ...this._stages];

        /* collect own routes */
        const routes: Route<RCtx>[] = this._routes.map((route) => {
            return {
                method: route.method,
                path: prefix + route.path,
                handler: route.handler,
                stages: [...combStages, ...(route.stages ?? [])]
            };
        });
        /* get sub routes */
        for (const child of this._children) {
            routes.push(...child.collectRoutes(prefix + child.prefix, combStages));
        }

        return routes;
    }


    /*** public HTTP functions ***/
    get(path: string, ...stages: Stage<any>[]) {
        this.on('GET', path, ...stages);
    }
    post(path: string, ...stages: Stage<any>[]) {
        this.on('POST', path, ...stages);
    }
    put(path: string, ...stages: Stage<any>[]) {
        this.on('PUT', path, ...stages);
    }
    patch(path: string, ...stages: Stage<any>[]) {
        this.on('PATCH', path, ...stages);
    }
    delete(path: string, ...stages: Stage<any>[]) {
        this.on('DELETE', path, ...stages);
    }
    // options(){} // TODO: needed?
    // head(){}    // TODO: needed?
}