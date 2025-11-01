import { describe, expect, it } from "vitest";
import { SchemaTypes } from "../../src/";

describe('validation - basic types', () => {
    /* number */
    it('String without numbers should not be parsed to number', () => {
        expect(() => {
            SchemaTypes.Number().validate('asd')
        }).toThrowError(TypeError);
    });
    it('Should parse the number', () => {
        expect(SchemaTypes.Number().validate(123)).toBeTypeOf('number');
    });
    /* string */
    it('Number should not be parsed to string', () => {
        expect(() => {
            SchemaTypes.String().validate(123)
        }).toThrowError(TypeError);
    });
    it('Should not parse empty string', () => {
        expect(() => {
            SchemaTypes.String().validate('')
        }).toThrowError(TypeError);
    })
    it('Should parse the string', () => {
        expect(SchemaTypes.String().validate('its a string')).toBeTypeOf('string');
    });
    /* boolean */
    it('Pure boolean should be parsed as boolean', () => {
        const parsedTrue = SchemaTypes.Boolean().validate(true);
        expect(parsedTrue).toEqual(true);
        const parsedFalse = SchemaTypes.Boolean().validate(false);
        expect(parsedFalse).toEqual(false);
    });
    it('boolean as string should be parsed as boolean', () => {
        const parsedTrue = SchemaTypes.Boolean().validate('true');
        const parsedFalse = SchemaTypes.Boolean().validate('false');
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('0 and 1 (number) should be parsed as boolean', () => {
        const parsedTrue = SchemaTypes.Boolean().validate(1);
        const parsedFalse = SchemaTypes.Boolean().validate(0);
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('0 and 1 (string) should be parsed as boolean', () => {
        const parsedTrue = SchemaTypes.Boolean().validate('1');
        const parsedFalse = SchemaTypes.Boolean().validate('0');
        expect(parsedTrue).toEqual(true);
        expect(parsedFalse).toEqual(false);
    });
    it('everything expect 0,1,true,false (string) should not be parsed as boolean', () => {
        expect(() => {
            SchemaTypes.Boolean().validate('T R U E')
        }).toThrowError(TypeError);
        expect(() => {
            SchemaTypes.Boolean().validate(3)
        }).toThrowError(TypeError);
        expect(() => {
            SchemaTypes.Boolean().validate('-1')
        }).toThrowError(TypeError);
    });
    /* date */
    /* array */
    /* object */
});