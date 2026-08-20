import { beforeAll, describe, expect, it, vi } from "vitest";
import { PipePress } from "../../src";
import fs, { unlink } from "fs";

/*** variables ***/
const PORT = 3004;
let app: PipePress;

/*** helper functions ***/
function uploadFile(path: string, filename: string, fileSize: number = 500 * 1024) {
    /* create file data */
    const fileDataRaw = "x".repeat(fileSize);
    const form = new FormData();
    form.append(filename, new Blob([Buffer.from(fileDataRaw)]), `${filename}.txt`);

    return fetch(`http://localhost:${PORT}${path}`, {
        method: 'POST',
        body: form
    });
}

/*** mocking ***/
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    const mockUnlink = vi.fn();

    return {
        ...actual,
        unlink: mockUnlink,
        default: {
            ...actual,
            unlink: mockUnlink
        }
    };
});

describe('PipePress basic functions', () => {
    beforeAll(async () => {
        app = new PipePress();

        /* route with mandorty file */
        app.post('/file-mandatory', {
            files: { avatar: { required: true } }
        }, async (ctx) => {
            return { success: true };
        });
        /* route with error */
        app.get('/error', async (ctx) => {
            throw new Error('Ill always be a failure!');
        });

        /* create server */
        app.build();
        await app.listen(PORT);
    })
    it('should trigger a failure while unlinking uploaded files', async () => {
        /* mockup unlink */
        const mockErr = new Error('Disk Error');
        vi.mocked(fs.unlink).mockImplementation((path, cb) => {
            if (typeof cb === 'function') {
                cb(mockErr);
            }
        });

        /* create async handler for error */
        const errPromise = new Promise((res, rej) => {
            const timer = setTimeout(() => {
                rej(new Error('Timeout: Error was not triggered after 2secs'));
            }, 2000);

            app.once('unlink_failed', (path, err) => {
                clearTimeout(timer);
                res(err);
            });
        });

        /* http call to trigger error */
        const res = await uploadFile('/file-mandatory', 'avatar');

        // const resData = await res.json();
        // console.log(resData);

        /* wait for error promise */
        const emittedError = await errPromise;

        expect(emittedError).toBe(mockErr);

        /* restore */
        vi.restoreAllMocks();
    });

    it('should trigger a failure while handle pipe errors', async () => {
        /* mock pipepress _sendReponse */
        const mockErr = new Error('Cant handle the errors');
        const sendRespMock = vi.spyOn(app as any, '_sendResponse').mockImplementation(() => { throw mockErr });

        /* setup error handler */
        const errPromise = new Promise((res, rej) => {
            const timer = setTimeout(() => {
                rej(new Error('Timeout: Error was not triggered after 2secs'));
            }, 2000);

            app.once('unable_to_response', (err) => {
                clearTimeout(timer);
                res(err);
            });
        });

        /* call endpoint */
        try {
            const res = await fetch(`http://localhost:${PORT}/error`);
        }
        catch (e) { /* fetch will fail */ }
        const emittedError = await errPromise;

        expect(sendRespMock).toHaveBeenCalled();
        expect(emittedError).toBe(mockErr);
    });
});