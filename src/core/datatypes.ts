/*** imports ***/
import { JSONSchema7 } from "json-schema";

/*** types ***/
export type SchemaDefinition = Record<string, DataType<any, boolean>>;
type ParsedSchema<T extends SchemaDefinition> =
    { [K in keyof T as T[K] extends DataType<any, true> ? K : never]?: ReturnType<T[K]["validate"]> } &
    { [K in keyof T as T[K] extends DataType<any, true> ? never : K]: ReturnType<T[K]["validate"]> };
export type ParsedType<T> = T extends DataType<any> ? ReturnType<T["validate"]> : undefined;

/*** support functions ***/
function isIsoDate(str: any): boolean {
    if (str === null || str === undefined) return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(str);
}
function validator<T extends DataType<any>>(type: { new(): T }) {
    return () => {
        return new type();
    }
}

/*** basic validation type ***/
export abstract class DataType<T, Optional extends boolean = false> {
    /* optional flag */
    optional: Optional = false as Optional;
    isOptional(): DataType<T, true> {
        this.optional = true as Optional;
        return this as unknown as DataType<T, true>;
    }

    /* validation */
    abstract validate(value: any): T;
    validateRequired(key: string, value: any): boolean {
        if (!this.optional && !(key in value)) throw new TypeError(`is required`);
        return true;
    }
    /* schema */
    abstract toJSONSchema(): JSONSchema7;
}

/*** type implementation ***/
class StringType extends DataType<string> {
    toJSONSchema(): JSONSchema7 {
        return { type: 'string' };
    }
    validate(value: any): string {
        if (typeof value !== 'string') throw new TypeError('is not a string');
        if (value.length === 0) throw new TypeError('String length is zero (0)');
        return String(value);
    }
}
class NumberType extends DataType<number> {
    toJSONSchema(): JSONSchema7 {
        return { type: 'number' };
    }
    validate(value: any): number {
        let tmp = parseFloat(value);
        if (isNaN(tmp)) throw TypeError('is not a number');
        return tmp;
    }
}
class BooleanType extends DataType<boolean> {
    toJSONSchema(): JSONSchema7 {
        return { type: 'boolean' };
    }
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
class DateType extends DataType<Date> {
    toJSONSchema(): JSONSchema7 {
        return { type: 'string', format: 'date-time' }
    }
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
class ArrayType<TItem = any> extends DataType<TItem[]> {
    private _itemValidator?: DataType<TItem, boolean>;

    toJSONSchema(): JSONSchema7 {
        return {
            type: 'array',
            items: this._itemValidator ? this._itemValidator.toJSONSchema() : {}
        };
    }
    validate(value: any): TItem[] {
        if (!Array.isArray(value)) throw new TypeError('is not an array');
        if (!this._itemValidator) return value.slice() as TItem[];

        const parsed: TItem[] = [];
        for (let i = 0; i < value.length; i++) {
            try {
                parsed.push(this._itemValidator.validate(value[i]));
            } catch (e) {
                if (e instanceof TypeError) {
                    throw new TypeError(`element[${i}] ${e.message}`);
                }
                throw e;
            }
        }
        return parsed;
    }

    of<T extends TItem = TItem>(itemValidator: DataType<T, boolean>): ArrayType<T> {
        (this as unknown as any)._itemValidator = itemValidator;
        return this as unknown as ArrayType<T>;
    }
}
class ObjectType<TSchema extends SchemaDefinition = any, Optional extends boolean = false> extends DataType<ParsedSchema<TSchema>, Optional> {
    _schema: TSchema;

    constructor(schema: TSchema) {
        super();
        this._schema = schema;
    }

    toJSONSchema(): JSONSchema7 {
        /* create base schema */
        const schema: JSONSchema7 = { type: 'object', properties: {}, required: [], additionalProperties: false };

        /* loop though schema definition */
        for (const key in this._schema) {
            const curSchema = this._schema[key];
            schema.properties![key] = curSchema.toJSONSchema();
            if (!curSchema.optional) {
                schema.required!.push(key);
            }
        }

        return schema;
    }

    validate(value: any): ParsedSchema<TSchema> {
        if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
            throw new TypeError('is not an object');
        }

        /* loop through entrys (keys) and validate / parsed them */
        const result: any = {};

        for (const key in this._schema) {
            const curSchema = this._schema[key];

            try {
                curSchema.validateRequired(key, value);

                if (key in value) {
                    const parsed = curSchema.validate(value[key]);
                    result[key] = parsed;
                }
            } catch (e) {
                if (e instanceof TypeError) {
                    throw new TypeError(`${key} ${e.message}`);
                }
                throw e;
            }
        }

        return result;
    }
}
/*** helper functions ***/
function Object<T extends SchemaDefinition>(schema: T) {
    return new ObjectType(schema);
}
/*** export validator types ***/
export default {
    String: validator(StringType),
    Number: validator(NumberType),
    Boolean: validator(BooleanType),
    Date: validator(DateType),
    Array: validator(ArrayType),
    Object
}