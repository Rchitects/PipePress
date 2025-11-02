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
class ArrayType<TItem = any> extends ValidatorType<TItem[]> {
    private _itemValidator?: ValidatorType<TItem, boolean>;

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

    of<T extends TItem = TItem>(itemValidator: ValidatorType<T, boolean>): ArrayType<T> {
        (this as unknown as any)._itemValidator = itemValidator;
        return this as unknown as ArrayType<T>;
    }
}
class ObjectType<TSchema extends SchemaDefinition = any> extends ValidatorType<ParsedSchema<TSchema>> {
    private _schema?: TSchema;

    of<T extends SchemaDefinition>(schema: T): ObjectType<T> {
        (this as unknown as any)._schema = schema;
        return this as unknown as ObjectType<T>;
    }

    validate(value: any): ParsedSchema<TSchema> {
        if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
            throw new TypeError('is not an object');
        }

        /* wihtout schema just provide a copy without any further validation */
        if (!this._schema) {
            return { ...value } as ParsedSchema<TSchema>;
        }

        /* loop through entrys (keys) and validate / parsed them */
        const result: any = {};

        for (const key in this._schema) {
            const curSchema = this._schema[key];

            try {
                curSchema.checkRequired(key, value);

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

/*** export validator types ***/
export const PipeTypes = {
    String: validator(StringType),
    Number: validator(NumberType),
    Boolean: validator(BooleanType),
    Date: validator(DateType),
    Array: validator(ArrayType),
    Object: validator(ObjectType)
}