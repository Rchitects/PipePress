/*** imports ***/
import { PipeStage } from "../core/types";
import { fastUUID, getIP } from "../core/utils";

/*** types ***/
type LogEntry = {
    timestamp: number;
    message: string;
};
/*** defintions ***/
let logBuffer: LogEntry[] = [];

/*** helper functions ***/
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;

/*** logger function ***/
function processLogBuffer() {
    while (logBuffer.length > 0) {
        const entry = logBuffer.shift();
        if (entry) {
            const msg = `[${new Date(entry.timestamp).toISOString()}] ${entry.message}`;
            process.stdout.write(msg + '\n');
        }
    }
}
function addToLogBuffer(message: string) {
    logBuffer.push({
        timestamp: Date.now(),
        message
    });
    if (logBuffer.length === 1) {
        setImmediate(processLogBuffer);
    }
}
/*** pipe-stage ***/
export const basicHTTPLogger = (printer?: (message: string) => void): PipeStage<void> => {
    return {
        handler: async (ctx) => {
            const { method, url } = ctx.req;
            const startTime = Date.now();
            const reqID = fastUUID(startTime);
            /* create start of request log message */
            const startMsg = `[${reqID}] ${method} ${url} by ${getIP(ctx.req)}`;
            if (printer) {
                printer(startMsg);
            }
            else {
                addToLogBuffer(startMsg);
            }
            /* on response finish, log the completion */
            ctx.res.on('finish', () => {
                const duration = Date.now() - startTime;
                let endMsg = `[${reqID}]`;
                if (ctx.res.statusCode < 400) {
                    endMsg += ` ${green(`${ctx.res.statusCode}`)}`;
                }
                else if (ctx.res.statusCode < 500) {
                    endMsg += ` ${yellow(`${ctx.res.statusCode}`)}`;
                }
                else {
                    endMsg += ` ${red(`${ctx.res.statusCode}`)}`;
                }
                endMsg += ` ${yellow(`+${duration}ms`)} `;

                if (printer) {
                    printer(endMsg);
                }
                else {
                    addToLogBuffer(endMsg);
                }
            });
        }
    };
};