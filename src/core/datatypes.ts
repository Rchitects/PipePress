/*** imports ***/
import { JSONSchema7 } from "json-schema";

/*** types ***/
export type SchemaDefinition<Optional extends boolean = boolean> = Record<string, DataType<any, Optional>>;
export type ParsedSchema<T extends SchemaDefinition> =
    { [K in keyof T as T[K] extends DataType<any, true> ? K : never]?: ReturnType<T[K]["validate"]> } &
    { [K in keyof T as T[K] extends DataType<any, true> ? never : K]: ReturnType<T[K]["validate"]> };
export type Infer<T> = T extends DataType<any> ? ReturnType<T["validate"]> : undefined;
type Constructor<T> = { new(): T };

/*** support functions ***/
export function isIsoDate(str: string): boolean {
    if (str === null || str === undefined) return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(str);
}
function validator<T extends DataType<any>>(type: Constructor<T>) {
    return () => {
        return new type();
    }
}
function literalValidator<P extends string | number>(validator: Constructor<DataType<P>>) {
    const inst = new validator();
    return <T extends P>(...values: T[]) => new LiteralType<T>(values, inst);
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
        if (typeof value === 'number') {
            return value;
        }
        else if (typeof value === 'string') {
            const tmp = parseFloat(value);
            if (isNaN(tmp)) throw TypeError('is not a number');
            return tmp;
        }
        throw TypeError('is not a number');
    }
}
class BooleanType extends DataType<boolean> {
    toJSONSchema(): JSONSchema7 {
        return { type: 'boolean' };
    }
    validate(value: any): boolean {
        if (typeof value === 'boolean') return value;
        /* try parse 'true' / 'false' */
        const boolStr = String(value).toLowerCase();
        if (boolStr === 'true') {
            return true;
        }
        else if (boolStr === 'false') {
            return false;
        }
        /* try parsing into number to convert 0 or 1 to bool */
        const boolNumber = parseFloat(boolStr);
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
                // validate() will only throw TypeError
                throw new TypeError(`element[${i}] ${(e as TypeError).message}`, { cause: e });
            }
        }
        return parsed;
    }

    of<T extends TItem = TItem>(itemValidator: DataType<T, boolean>): ArrayType<T> {
        this._itemValidator = itemValidator;
        return this as unknown as ArrayType<T>;
    }
}
export class ObjectType<TSchema extends SchemaDefinition = any, Optional extends boolean = false> extends DataType<ParsedSchema<TSchema>, Optional> {
    #schema: TSchema;

    constructor(schema: TSchema) {
        super();
        this.#schema = schema;
    }

    toJSONSchema(): JSONSchema7 {
        /* create base schema */
        const schema: JSONSchema7 = { type: 'object', properties: {}, required: [], additionalProperties: false };

        /* loop though schema definition */
        for (const key in this.#schema) {
            const curSchema = this.#schema[key];
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

        for (const key in this.#schema) {
            const curSchema = this.#schema[key];

            try {
                curSchema.validateRequired(key, value);

                if (key in value) {
                    const parsed = curSchema.validate(value[key]);
                    result[key] = parsed;
                }
            } catch (e) {
                // validate() will only throw TypeError
                throw new TypeError(`${key} ${(e as TypeError).message}`, { cause: e });
            }
        }

        return result as ParsedSchema<TSchema>;
    }

    extend<ExtSchema extends SchemaDefinition>(schema: ExtSchema): ObjectType<TSchema & ExtSchema> {
        // TODO: does not work for deep objects
        const combined = { ...this.#schema, ...schema };
        return new ObjectType(combined);
    }
}
class LiteralType<T extends string | number> extends DataType<T> {
    #values: readonly T[];
    #validator: DataType<any>

    constructor(values: readonly T[], validator: DataType<any>) {
        super();
        this.#values = values;
        this.#validator = validator;
    }
    toJSONSchema(): JSONSchema7 {
        return { enum: [...this.#values] };
    }

    validate(value: any): T {
        const parsed = this.#validator.validate(value) as T;
        if (!this.#values.includes(parsed)) {
            throw new TypeError(`must be one of: ${this.#values.map(v => `'${v}'`).join(' | ')}`);
        }
        return parsed;
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
    Object,
    StringLiteral: literalValidator(StringType),
    NumberLiteral: literalValidator(NumberType),
}