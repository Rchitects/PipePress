/*** imports ***/
import { HTTPContentType } from "./types";

/*** functions ***/
export const isContentType = (source: HTTPContentType | string, ofType: HTTPContentType): boolean => {
    return source.toString().includes(ofType);
}