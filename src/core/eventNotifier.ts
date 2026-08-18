/*** imports ***/
import { EventEmitter } from "stream";

/*** types ***/
export type EventMap = Record<string, unknown[]>;
export type OnErrorHandler = {
    error: (err: string, meta?: Record<string, unknown>) => void;
}

/*** definitions ***/
const consoleLogger: OnErrorHandler = {
    error: (err, meta?) => { console.warn(err, meta) }
}

/*** functions ***/
function isErrorEvent(event: string): boolean {
    return event.includes('error');
}

/*** class ***/
export class Notifier<TEvents extends EventMap> {
    #emitter = new EventEmitter();
    #onUnhandledErrorHandler: OnErrorHandler = consoleLogger;   // FIXME: #28 allow to override this handler

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
    protected emit<TEventName extends keyof TEvents & string>(
        eventName: TEventName,
        ...args: TEvents[TEventName]
    ): boolean {
        /* check if error event */
        if (isErrorEvent(eventName)) {
            const listenerCount = this.#emitter.listenerCount(eventName);
            const err = args.find(a => a instanceof Error) as Error | undefined;
            if (listenerCount <= 0) {
                if (err) {
                    this.#onUnhandledErrorHandler.error(`Unhandled error ${eventName}`, { err });
                }
                else {
                    this.#onUnhandledErrorHandler.error(`Unhandled error ${eventName} without Error instance`, { args });
                }
                return false;
            }
        }
        return this.#emitter.emit(eventName, ...args);
    }
}