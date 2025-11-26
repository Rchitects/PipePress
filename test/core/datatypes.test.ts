import { describe, expect, it } from "vitest";
import dt, { isIsoDate } from "../../src/core/datatypes";

describe('validation - basic types', () => {
    /* predefine validators */
    const number = dt.Number();
    const string = dt.String();
    const boolean = dt.Boolean();
    const date = dt.Date();
    /* iIsoDate */
    it('should return false for empty stgrings', () => {
        expect(isIsoDate('')).toBe(false);
        expect(isIsoDate(null)).toBe(false);
        expect(isIsoDate(undefined)).toBe(false);
    });
    /* number */
    it('String without numbers should not be parsed to number', () => {
        expect(() => {
            number.validate('asd')
        }).toThrowError(TypeError);
    });
    it('Should parse the number', () => {
        expect(number.validate(123)).toBeTypeOf('number');
    });
    it('Should parse to number JSON Schema', () => {
        const schema = number.toJSONSchema();
        expect(schema).toEqual({ type: 'number' });
    });

    /* string */
    it('Number should not be parsed to string', () => {
        expect(() => {
            string.validate(123)
        }).toThrowError(TypeError);
    });
    it('Should not parse empty string', () => {
        expect(() => {
            string.validate('')
        }).toThrowError(TypeError);
    })
    it('Should parse the string', () => {
        expect(string.validate('its a string')).toBeTypeOf('string');
    });
    it('Should parse to string JSON Schema', () => {
        const schema = string.toJSONSchema();
        expect(schema).toEqual({ type: 'string' });
    });
    /* boolean */
    it('Pure boolean should be parsed as boolean', () => {
        const parsedTrue = boolean.validate(true);
        expect(parsedTrue).toEqual(true);
        const parsedFalse = boolean.validate(false);
        expect(parsedFalse).toEqual(false);
    });
    it('boolean as string should be parsed as boolean', () => {
        const parsedTrue = boolean.validate('true');
        const parsedFalse = boolean.validate('false');
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('0 and 1 (number) should be parsed as boolean', () => {
        const parsedTrue = boolean.validate(1);
        const parsedFalse = boolean.validate(0);
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('0 and 1 (string) should be parsed as boolean', () => {
        const parsedTrue = boolean.validate('1');
        const parsedFalse = boolean.validate('0');
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('everything expect 0,1,true,false (string) should not be parsed as boolean', () => {
        expect(() => {
            boolean.validate('T R U E')
        }).toThrowError(TypeError);
        expect(() => {
            boolean.validate(3)
        }).toThrowError(TypeError);
        expect(() => {
            boolean.validate('-1')
        }).toThrowError(TypeError);
    });
    it('Should parse to boolean JSON Schema', () => {
        const schema = boolean.toJSONSchema();
        expect(schema).toEqual({ type: 'boolean' });
    });
    /* date */
    it('should return date JSON schema', () => {
        const schema = date.toJSONSchema();
        expect(schema).toEqual({ type: 'string', format: 'date-time' });
    });
    it('Should not parse a date object', () => {
        const now = new Date();
        const parsed = date.validate(now);
        expect(parsed).toEqual(now);
    });
    it('Should parse a number timestampe to date', () => {
        let dateAsNumber = 123456;
        const parsed = date.validate(dateAsNumber);
        expect(parsed.getTime()).toEqual(dateAsNumber);
    });
    it('Should parse a date string to date', () => {
        let dateAsString = '2024-01-01T00:00:00.000Z';
        const parsed = date.validate(dateAsString);
        expect(parsed.toISOString()).toEqual(dateAsString);
    });
    it('Should not parse invalid date string', () => {
        expect(() => {
            date.validate('invalid-date-string');
        }).toThrowError(TypeError);
    });
    /* array */
    it('Should return any empty array JSON schema', () => {
        const array = dt.Array();
        const schema = array.toJSONSchema();
        expect(schema).toEqual({ type: 'array', items: {} });
    });
    it('Should parse any array of no type is used', () => {
        const array = dt.Array();
        const parsed = array.validate([1, 'string', true, {}, []]);
        expect(parsed).toEqual([1, 'string', true, {}, []]);
    });
    it('Should not parse non-array', () => {
        const array = dt.Array();
        expect(() => {
            array.validate('not-an-array');
        }).toThrowError(TypeError);
    });
    it('Should return typed array JSON schema', () => {
        const numArray = dt.Array().of(dt.Number());
        const strArray = dt.Array().of(dt.String());
        // TODO: more types
        const numSchema = numArray.toJSONSchema();
        const strSchema = strArray.toJSONSchema();
        expect(numSchema).toEqual({ type: 'array', items: { type: 'number' } });
        expect(strSchema).toEqual({ type: 'array', items: { type: 'string' } });
    });
    it('Should fail parsing array with wrong types', () => {
        const numArray = dt.Array().of(dt.Number());
        expect(() => {
            numArray.validate([123, 'not-a-number']);
        }).toThrowError(TypeError);
    });
    it('Should parse array with correct types', () => {
        const strArray = dt.Array().of(dt.String());
        const parsed = strArray.validate(['string one', 'string two']);
        expect(parsed).toEqual(['string one', 'string two']);
    });
    /* object */
    it('Should return object JSOO schema', () => {
        const object = dt.Object({
            name: dt.String(),
            age: dt.Number().isOptional()
        });
        const schema = object.toJSONSchema();
        expect(schema.type).toEqual('object');
        expect(schema.properties).toBeDefined();
        expect(schema.properties?.name).toEqual({ type: 'string' });
        expect(schema.properties?.age).toEqual({ type: 'number' });
        expect(schema.required).not.toContain('age');
        expect(schema.required).toContain('name');
    });
    it('Should not parse non object types', () => {
        const object = dt.Object({
            name: dt.String()
        });

        expect(() => {
            object.validate(null);
        }).toThrowError(TypeError);
        expect(() => {
            object.validate(undefined);
        }).toThrowError(TypeError);
        expect(() => {
            object.validate('just a string');
        }).toThrowError(TypeError);
        expect(() => {
            object.validate([]);
        }).toThrowError(TypeError);
    });
    it('Should not parse object with missing required fields', () => {
        const object = dt.Object({
            name: dt.String(),
            age: dt.Number()
        });
        expect(() => {
            object.validate({ name: 'John' });
        }).toThrowError(TypeError);
    });
    it('Should not parse object with wrong field types even when optional', () => {
        const object = dt.Object({
            name: dt.String(),
            age: dt.Number().isOptional()
        });
        expect(() => {
            object.validate({ name: 'John', age: 'not-a-number' });
        }).toThrowError(TypeError);
    });
    it('Should parse object with correct field types', () => {
        const object = dt.Object({
            name: dt.String(),
            age: dt.Number().isOptional(),
            birth: dt.Date()
        });
        const birthDate = new Date('1993-01-01T00:00:00.000Z');
        const parsed = object.validate({ name: 'John', age: 30, birth: birthDate.toISOString() });
        expect(parsed).toEqual({ name: 'John', age: 30, birth: birthDate });
    });
});