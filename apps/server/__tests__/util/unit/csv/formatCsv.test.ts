import { describe, expect, test } from 'vite-plus/test';
import { CsvByteOrderMark } from '../../../../src/util/csv/CsvByteOrderMark';
import { formatCsv } from '../../../../src/util/csv/formatCsv';

describe('formatCsv (cells)', () => {
  test('GIVEN plain cells WHEN formatting THEN joins them with commas and CRLF after a byte order mark', () => {
    expect(
      formatCsv([
        ['name', 'code'],
        ['Ada', 'AB12'],
      ]),
    ).toBe(`${CsvByteOrderMark}name,code\r\nAda,AB12\r\n`);
  });

  test('GIVEN commas, quotes and line breaks WHEN formatting THEN quotes the cell and doubles its quotes', () => {
    expect(formatCsv([['Lovelace, Ada', 'say "hi"', 'two\nlines']])).toBe(
      `${CsvByteOrderMark}"Lovelace, Ada","say ""hi""","two\nlines"\r\n`,
    );
  });

  test.each(['=1+1', '+1', '-1', '@SUM(A1)'])(
    'GIVEN %s WHEN formatting THEN adds an apostrophe so spreadsheets show it as text',
    (cell) => {
      expect(formatCsv([[cell]])).toBe(`${CsvByteOrderMark}'${cell}\r\n`);
    },
  );
});
