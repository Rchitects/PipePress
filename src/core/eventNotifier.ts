/*** imports ***/
import { EventEmitter } from "stream";

/*** types ***/
export type EventMap = Record<string, unknown[]>;

/*** class ***/
export class Notifier<TEvents extends EventMap> {
    #emitter = new EventEmitter();

    /*** public functions ***/
    on<TEventName extends keyof TEvents & string>(
        eventName: TEventName,
        handler: (...args: TEvents[TEventName]) => void
    ): this {
        this.#emitter.on(eventName, handler);
        return this;
    }
    off<TEventName extends keyof TEvents & string>(
        eventName: TEventName,
        handler: (...args: TEvents[TEventName]) => void
    ): this {
        this.#emitter.off(eventName, handler as (...args: any[]) => void);
        return this;
    }

    once<TEventName extends keyof TEvents & string>(
        eventName: TEventName,
        handler: (...args: TEvents[TEventName]) => void
    ): this {
        this.#emitter.once(eventName, handler as (...args: any[]) => void);
        return this;
    }

    /*** protected functions ***/
    protected _emit<TEventName extends keyof TEvents & string>(
        eventName: TEventName,
        ...args: TEvents[TEventName]
    ): boolean {
        return this.#emitter.emit(eventName, ...args);
    }
}