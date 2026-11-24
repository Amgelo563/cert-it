import { describe, expect, test } from 'vite-plus/test';
import { CertificateExportRoutes } from '../../../../src/certificate/export/CertificateExportRoutes';

const ByteOrderMark = '﻿';

// exposes the CSV formatting, which the routes only use internally
class ExposedExportRoutes extends CertificateExportRoutes {
  public static override formatCsv(
    rows: readonly (readonly string[])[],
  ): string {
    return super.formatCsv(rows);
  }
}

describe('CertificateExportRoutes (formatCsv)', () => {
  test('GIVEN plain cells WHEN formatting THEN joins them with commas and CRLF after a byte order mark', () => {
    expect(
      ExposedExportRoutes.formatCsv([
        ['name', 'code'],
        ['Ada', 'AB12'],
      ]),
    ).toBe(`${ByteOrderMark}name,code\r\nAda,AB12\r\n`);
  });

  test('GIVEN commas, quotes and line breaks WHEN formatting THEN quotes the cell and doubles its quotes', () => {
    expect(
      ExposedExportRoutes.formatCsv([
        ['Lovelace, Ada', 'say "hi"', 'two\nlines'],
      ]),
    ).toBe(`${ByteOrderMark}"Lovelace, Ada","say ""hi""","two\nlines"\r\n`);
  });

  test.each(['=1+1', '+1', '-1', '@SUM(A1)'])(
    'GIVEN %s WHEN formatting THEN adds an apostrophe so spreadsheets show it as text',
    (cell) => {
      expect(ExposedExportRoutes.formatCsv([[cell]])).toBe(
        `${ByteOrderMark}'${cell}\r\n`,
      );
    },
  );
});
