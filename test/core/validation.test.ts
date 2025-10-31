import { describe, expect, it } from "vitest";
import { SchemaTypes } from "../../src/";

describe('Basic validation tests', () => {
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
});