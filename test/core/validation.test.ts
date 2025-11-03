import { describe, expect, it } from "vitest";
import val from "../../src/core/validation";

describe('validation - basic types', () => {
    /* predefine validators */
    const number = val.Number();
    const string = val.String();
    const boolean = val.Boolean();
    /* number */
    it('String without numbers should not be parsed to number', () => {
        expect(() => {
            number.validate('asd')
        }).toThrowError(TypeError);
    });
    it('Should parse the number', () => {
        expect(number.validate(123)).toBeTypeOf('number');
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
    /* date */
    /* array */
    /* object */
    it('debug', () => {
        const schema = val.Object().of({
            name: val.String().isOptional(),
            age: val.Number()
        });
        expect(() => {
            const parsed = schema.validate({});
        }).toThrowError(TypeError);
    });
});