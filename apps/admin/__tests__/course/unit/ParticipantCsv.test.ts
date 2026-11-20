import { describe, expect, test } from 'vite-plus/test';
import {
  buildImportRows,
  hasRequiredColumns,
} from '../../../src/course/participants/import/buildImportRows';
import { ColumnRoleEnum } from '../../../src/course/participants/import/ColumnRoleEnum';
import { guessColumnRoles } from '../../../src/course/participants/import/guessColumnRoles';
import { readCsv } from '../../../src/course/participants/import/readCsv';

const { Name, Email, Extra, Ignore } = ColumnRoleEnum;

function utf8(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

// Windows-1252 matches Latin-1 for these letters
function windows1252(text: string): ArrayBuffer {
  return Uint8Array.from(text, (char) => char.charCodeAt(0)).buffer;
}

describe('readCsv', () => {
  test('GIVEN a UTF-8 file with a BOM, commas and blank lines WHEN reading THEN returns trimmed cells and their line numbers', () => {
    const table = readCsv(
      utf8(
        '﻿Nombre,Correo\r\n José Pérez , jose@uni.pe\r\n\r\nAna,ana@uni.pe\r\n',
      ),
    );

    expect(table).toEqual({
      headers: ['Nombre', 'Correo'],
      rows: [
        { line: 2, cells: ['José Pérez', 'jose@uni.pe'] },
        { line: 4, cells: ['Ana', 'ana@uni.pe'] },
      ],
    });
  });

  test('GIVEN a Windows-1252 file with semicolons WHEN reading THEN decodes accents and splits on semicolons', () => {
    const table = readCsv(windows1252('nombre;correo\nMuñoz Peña;m@x.pe\n'));

    expect(table.rows).toEqual([{ line: 2, cells: ['Muñoz Peña', 'm@x.pe'] }]);
  });

  test('GIVEN quoted cells and short rows WHEN reading THEN keeps commas in quotes and fills missing cells', () => {
    const table = readCsv(
      utf8('name,email,group\n"Lovelace, Ada",ada@x.org\n'),
    );

    expect(table.rows[0]?.cells).toEqual(['Lovelace, Ada', 'ada@x.org', '']);
  });

  test('GIVEN an empty file WHEN reading THEN returns no headers or rows', () => {
    expect(readCsv(utf8('\n\n'))).toEqual({ headers: [], rows: [] });
  });
});

describe('guessColumnRoles', () => {
  test.each([
    [
      ['Nombres y Apellidos', 'Correo electrónico', 'DNI'],
      [Name, Email, Extra],
    ],
    [
      ['E-mail', 'Full name', ''],
      [Email, Name, Ignore],
    ],
    [
      ['Name', 'Name', 'Email'],
      [Name, Extra, Email],
    ],
    [
      ['id', 'grupo'],
      [Extra, Extra],
    ],
  ])('GIVEN the headers %j WHEN guessing THEN returns %j', (headers, roles) => {
    expect(guessColumnRoles(headers)).toEqual(roles);
  });
});

describe('buildImportRows', () => {
  test('GIVEN mapped columns WHEN building rows THEN keys extras by header and numbers repeated ones', () => {
    const table = {
      headers: ['Group', 'Name', 'Email', 'Group', 'Notes'],
      rows: [{ line: 2, cells: ['A', 'Ada', 'ada@x.org', 'B', 'n'] }],
    };

    expect(buildImportRows(table, [Extra, Name, Email, Extra, Ignore])).toEqual(
      [
        {
          name: 'Ada',
          email: 'ada@x.org',
          extra: { Group: 'A', 'Group (2)': 'B' },
        },
      ],
    );
  });

  test('GIVEN no extra columns WHEN building rows THEN leaves extra out', () => {
    const table = {
      headers: ['n', 'e'],
      rows: [{ line: 2, cells: ['Ada', 'a@x.org'] }],
    };

    expect(buildImportRows(table, [Name, Email])).toEqual([
      { name: 'Ada', email: 'a@x.org' },
    ]);
  });

  test.each([
    [[Name, Email], true],
    [[Name, Extra], false],
    [[Name, Name, Email], false],
  ])('GIVEN the roles %j WHEN checking THEN returns %s', (roles, expected) => {
    expect(hasRequiredColumns(roles)).toBe(expected);
  });
});
