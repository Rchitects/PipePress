/*** imports ***/
import { HTTPContentType } from "./types";

/*** functions ***/
export const isContentType = (source: HTTPContentType | string, ofType: HTTPContentType): boolean => {
    return source.toString().includes(ofType);
}
export const fastUUID = (time: number = Date.now()) => {
    const tsHex = time.toString(16).padStart(12, "0");
    const randHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, "0");
    return tsHex + randHex; /* always 18 characters long -- 12 from timestamp, 6 from random */
};
