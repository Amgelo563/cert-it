import { describe, expect, test } from 'vite-plus/test';
import { CourseFieldTypeEnum } from '../../../src/field/CourseFieldTypeEnum';
import { FieldDateOrderEnum } from '../../../src/field/FieldDateOrderEnum';
import { FieldValueErrorEnum } from '../../../src/field/FieldValueErrorEnum';
import { parseFieldCell } from '../../../src/field/parseFieldCell';

const Options = { dateOrder: FieldDateOrderEnum.DayFirst };

describe('parseFieldCell', () => {
  test('GIVEN a blank cell WHEN parsing THEN answers empty', () => {
    expect(parseFieldCell(CourseFieldTypeEnum.Number, '  ', Options)).toEqual({
      empty: true,
    });
  });

  test.each([
    ['18.5', 18.5],
    ['18,5', 18.5],
    ['-3', -3],
  ])('GIVEN the number %s WHEN parsing THEN answers %d', (cell, value) => {
    expect(parseFieldCell(CourseFieldTypeEnum.Number, cell, Options)).toEqual({
      value,
    });
  });

  test.each(['1.234,5', '12a', '1e5'])(
    'GIVEN %s WHEN parsing a number THEN answers invalid',
    (cell) => {
      expect(parseFieldCell(CourseFieldTypeEnum.Number, cell, Options)).toEqual(
        { error: FieldValueErrorEnum.InvalidNumber },
      );
    },
  );

  test.each([
    ['Sí', true],
    ['YES', true],
    ['x', true],
    ['✓', true],
    ['No', false],
    ['0', false],
  ])('GIVEN %s WHEN parsing a boolean THEN answers %s', (cell, value) => {
    expect(parseFieldCell(CourseFieldTypeEnum.Boolean, cell, Options)).toEqual({
      value,
    });
  });

  test('GIVEN an unknown word WHEN parsing a boolean THEN answers invalid', () => {
    expect(
      parseFieldCell(CourseFieldTypeEnum.Boolean, 'maybe', Options),
    ).toEqual({ error: FieldValueErrorEnum.InvalidBoolean });
  });

  test('GIVEN text over the limit WHEN parsing THEN answers too long', () => {
    expect(
      parseFieldCell(CourseFieldTypeEnum.Text, 'a'.repeat(1001), Options),
    ).toEqual({ error: FieldValueErrorEnum.TooLong });
  });

  test('GIVEN a stored image name WHEN parsing THEN keeps it', () => {
    const image = `${'a'.repeat(64)}.png`;
    expect(parseFieldCell(CourseFieldTypeEnum.Image, image, Options)).toEqual({
      value: image,
    });
  });
});
