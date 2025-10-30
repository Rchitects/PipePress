/*** imports ***/
/*** types ***/
export type SchemaDefinition = Record<string, ValidatorType<any, boolean>>;
type ParsedSchema<T extends SchemaDefinition> =
    { [K in keyof T as T[K] extends ValidatorType<any, true> ? K : never]?: ReturnType<T[K]["validate"]> } &
    { [K in keyof T as T[K] extends ValidatorType<any, true> ? never : K]: ReturnType<T[K]["validate"]> };

/*** support functions ***/
function isIsoDate(str: any): boolean {
    if (str === null || str === undefined) return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(str);
}
function validator<T extends ValidatorType<any>>(type: { new(): T }) {
    return () => {
        return new type();
    }
}
export function validateAndParseSchema<T extends SchemaDefinition>(schema: T, source: any): ParsedSchema<T> {
    const result: any = {};

    if (source === undefined || source === null || Object.keys(source).length === 0) throw new TypeError('Validation source is missing / undefined');

    for (const key in schema) {
        const curSchema = schema[key];

        try {
            /* check optinal */
            curSchema.checkRequired(key, source);

            if (key in source) {
                /* key was found, validate even if optional or not */
                const parsed = curSchema.validate(source[key])
                result[key] = parsed;
            }
        }
        catch (e) {
            if (e instanceof TypeError) {
                throw new TypeError(`${key} ${e.message}`);
            }
            throw e;
        }

    }

    return result;
}

/*** basic validation type ***/
abstract class ValidatorType<T, Optional extends boolean = false> {
    private _optional: Optional = false as Optional;

    abstract validate(value: any): T;
    isOptional(): ValidatorType<T, true> {
        this._optional = true as Optional;
        return this as unknown as ValidatorType<T, true>;
    }
    public checkRequired(key: string, value: any): boolean {
        if (!this._optional && !(key in value)) throw new TypeError(`is required`);
        return true;
    }
}

/*** type implementation ***/
class StringType extends ValidatorType<string> {
    validate(value: any): string {
        if (typeof value !== 'string') throw new TypeError('is not a string');
        if (value.length === 0) throw new TypeError('String length is zero (0)');
        return String(value);
    }
}
class NumberType extends ValidatorType<number> {
    validate(value: any): number {
        let tmp = parseFloat(value);
        if (isNaN(tmp)) throw TypeError('is not a number');
        return tmp;
    }
}
class BooleanType extends ValidatorType<boolean> {
    validate(value: any): boolean {
        if (typeof value === 'boolean') return value;
        /* try parse 'true' / 'false' */
        let boolStr = String(value).toLowerCase();
        if (boolStr === 'true') {
            return true;
        }
        else if (boolStr === 'false') {
            return false;
        }
        /* try parsing into number to convert 0 or 1 to bool */
        let boolNumber = parseFloat(value);
        if (isNaN(boolNumber)) throw new TypeError('is not a boolean or boolean-like(0,1,true,false)');
        if (boolNumber === 0) {
            return false;
        }
        else if (boolNumber === 1) {
            return true;
        }
        /* no parsing worked */
        throw new TypeError('is not a boolean or boolean-like(0,1,true,false)');
    }
}
class DateType extends ValidatorType<Date> {
    validate(value: any): Date {
        /* pure date */
        if (value instanceof Date) {
            return value;
        }
        /* timestamp */
        if (typeof value === 'number') {
            const date = new Date(value);
            return date;
        }
        /* iso date */
        if (typeof value === 'string' && isIsoDate(value)) {
            const date = new Date(value);
            return date;
        }

        /* none of all matched */
        throw new TypeError('is not a valid Date');
    }
}

/*** export validator types ***/
export const SchemaTypes = {
    String: validator(StringType),
    Number: validator(NumberType),
    Boolean: validator(BooleanType),
    Date: validator(DateType)
}