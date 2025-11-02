import { describe, expect, it } from "vitest";
import { PipeTypes } from "../../src/";

describe('validation - basic types', () => {
    /* number */
    it('String without numbers should not be parsed to number', () => {
        expect(() => {
            PipeTypes.Number().validate('asd')
        }).toThrowError(TypeError);
    });
    it('Should parse the number', () => {
        expect(PipeTypes.Number().validate(123)).toBeTypeOf('number');
    });
    /* string */
    it('Number should not be parsed to string', () => {
        expect(() => {
            PipeTypes.String().validate(123)
        }).toThrowError(TypeError);
    });
    it('Should not parse empty string', () => {
        expect(() => {
            PipeTypes.String().validate('')
        }).toThrowError(TypeError);
    })
    it('Should parse the string', () => {
        expect(PipeTypes.String().validate('its a string')).toBeTypeOf('string');
    });
    /* boolean */
    it('Pure boolean should be parsed as boolean', () => {
        const parsedTrue = PipeTypes.Boolean().validate(true);
        expect(parsedTrue).toEqual(true);
        const parsedFalse = PipeTypes.Boolean().validate(false);
        expect(parsedFalse).toEqual(false);
    });
    it('boolean as string should be parsed as boolean', () => {
        const parsedTrue = PipeTypes.Boolean().validate('true');
        const parsedFalse = PipeTypes.Boolean().validate('false');
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('0 and 1 (number) should be parsed as boolean', () => {
        const parsedTrue = PipeTypes.Boolean().validate(1);
        const parsedFalse = PipeTypes.Boolean().validate(0);
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('0 and 1 (string) should be parsed as boolean', () => {
        const parsedTrue = PipeTypes.Boolean().validate('1');
        const parsedFalse = PipeTypes.Boolean().validate('0');
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('everything expect 0,1,true,false (string) should not be parsed as boolean', () => {
        expect(() => {
            PipeTypes.Boolean().validate('T R U E')
        }).toThrowError(TypeError);
        expect(() => {
            PipeTypes.Boolean().validate(3)
        }).toThrowError(TypeError);
        expect(() => {
            PipeTypes.Boolean().validate('-1')
        }).toThrowError(TypeError);
    });
    /* date */
    /* array */
    /* object */
    it('debug', () => {
        const schema = PipeTypes.Object().of({
            name: PipeTypes.String().isOptional(),
            age: PipeTypes.Number()
        });
        expect(() => {
            const parsed = schema.validate({});
        }).toThrowError(TypeError);
    });
});