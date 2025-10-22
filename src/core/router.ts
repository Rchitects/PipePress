/*** imports ***/
import type { HTTPMethod, Route, PipeStage, RouteCompiled, PipeRoute, } from "./types";

/*** defintions ***/

/*** class ***/
export class Router {
    /*** variables ***/
    private _stages: PipeStage<any>[] = [];
    private _routes: Route[] = [];
    private _children: { prefix: string, router: Router }[] = [];

    /*** public functions ***/
    use(stage: PipeStage<any>): Router {
        this._stages.push(stage);
        return this;
    }

    on(method: HTTPMethod, path: string, handler: PipeRoute<any>, ...stages: PipeStage<any>[]) {
        this._routes.push({
            method: method,
            path: path,
            handler: handler,
            stages: stages
        })
    }
    // TODO: Typesafety
    mount(path: string, router: Router) {
        this._children.push({ prefix: path, router: router });
    }

    collectRoutes(prefix: string = '', inheritedStages: PipeStage<any>[] = []): RouteCompiled[] {
        const combStages = [...inheritedStages, ...this._stages];

        /* collect own routes */
        const routes: RouteCompiled[] = this._routes.map((route) => {
            return {
                fullPath: prefix + route.path,
                method: route.method,
                pipeline: [...combStages, ...(route.stages ?? [])],
                handler: route.handler
            };
        });
        /* get sub routes */
        for (const { prefix: subPrefix, router } of this._children) {
            routes.push(...router.collectRoutes(prefix + subPrefix, combStages));
        }

        return routes;
    }


    /*** public HTTP functions ***/
    //TODO: change ...stages and sers. to an option parameter?
    get(path: string, handler: PipeRoute<any>, ...stages: PipeStage<any>[]) {
        this.on('GET', path, handler, ...stages);
    }
    post(path: string, handler: PipeRoute<any>, ...stages: PipeStage<any>[]) {
        this.on('POST', path, handler, ...stages);
    }
    put(path: string, handler: PipeRoute<any>, ...stages: PipeStage<any>[]) {
        this.on('PUT', path, handler, ...stages);
    }
    patch(path: string, handler: PipeRoute<any>, ...stages: PipeStage<any>[]) {
        this.on('PATCH', path, handler, ...stages);
    }
    delete(path: string, handler: PipeRoute<any>, ...stages: PipeStage<any>[]) {
        this.on('DELETE', path, handler, ...stages);
    }
    // options(){} // TODO: needed?
    // head(){}    // TODO: needed?
}