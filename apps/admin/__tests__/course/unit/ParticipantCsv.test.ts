import { zipSync } from 'fflate';
import {
  type CourseFieldSummary,
  CourseFieldTypeEnum,
  FieldValueErrorEnum,
  LocaleEnum,
} from '@cert-it/shared';
import { describe, expect, test } from 'vite-plus/test';
import {
  buildImportRows,
  hasRequiredColumns,
} from '../../../src/course/participants/import/buildImportRows';
import {
  ColumnRoleEnum,
  fieldRole,
} from '../../../src/course/participants/import/ColumnRoleEnum';
import { columnsProblem } from '../../../src/course/participants/import/columnsProblem';
import {
  guessColumnRoles,
  guessFieldType,
} from '../../../src/course/participants/import/guessColumnRoles';
import { indexImages } from '../../../src/course/participants/import/ImageIndex';
import { readCsv } from '../../../src/course/participants/import/readCsv';

const { Name, Email, New, Ignore } = ColumnRoleEnum;

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

const Fields: CourseFieldSummary[] = [
  {
    id: 7,
    courseId: 1,
    label: 'Grupo',
    type: CourseFieldTypeEnum.Text,
    required: false,
    position: 0,
    valueCount: 0,
  },
  {
    id: 8,
    courseId: 1,
    label: 'Foto',
    type: CourseFieldTypeEnum.Image,
    required: false,
    position: 1,
    valueCount: 0,
  },
];

describe('guessColumnRoles', () => {
  test.each([
    [
      ['Nombres y Apellidos', 'Correo electrónico', 'DNI'],
      [Name, Email, New],
    ],
    [
      ['E-mail', 'Full name', ''],
      [Email, Name, Ignore],
    ],
    [
      ['Name', 'Name', 'Email'],
      [Name, New, Email],
    ],
  ])('GIVEN the headers %j WHEN guessing THEN returns %j', (headers, roles) => {
    expect(guessColumnRoles(headers)).toEqual(roles);
  });

  test('GIVEN headers matching course fields but for case and accents WHEN guessing THEN maps each field once', () => {
    expect(guessColumnRoles(['grupo', 'GRUPO', 'foto '], Fields)).toEqual([
      fieldRole(7),
      New,
      fieldRole(8),
    ]);
  });
});

describe('guessFieldType', () => {
  test.each([
    [['18,5', '20', ''], CourseFieldTypeEnum.Number],
    [['24/11/2026', '2026-01-03'], CourseFieldTypeEnum.Date],
    [['sí', 'no'], CourseFieldTypeEnum.Boolean],
    [['ana.JPG', 'bob.png'], CourseFieldTypeEnum.Image],
    [['A', '1'], CourseFieldTypeEnum.Text],
  ])('GIVEN the cells %j WHEN guessing THEN returns %s', (cells, type) => {
    const table = {
      headers: ['x'],
      rows: cells.map((cell, index) => ({ line: index + 2, cells: [cell] })),
    };

    expect(guessFieldType(table, 0, LocaleEnum.Es)).toBe(type);
  });
});

describe('columnsProblem', () => {
  test.each([
    [
      [Name, Email, fieldRole(7), fieldRole(7)],
      ['n', 'e', 'a', 'b'],
      'fieldImport.duplicateField',
    ],
    [[Name, Email, New], ['n', 'e', 'Grupo'], 'fieldImport.labelTaken'],
    [
      [Name, Email, New, New],
      ['n', 'e', 'Sede', 'sede'],
      'fieldImport.labelTaken',
    ],
    [[Name, Email, New, fieldRole(7)], ['n', 'e', 'Sede', 'g'], null],
  ] as const)(
    'GIVEN the roles %j WHEN checking THEN returns %s',
    (roles, headers, problem) => {
      expect(columnsProblem(roles, headers, Fields)).toBe(problem);
    },
  );
});

describe('buildImportRows', () => {
  test('GIVEN columns mapped to fields WHEN building rows THEN keys cells by field ID', async () => {
    const table = {
      headers: ['Grupo', 'Name', 'Email', 'Notes'],
      rows: [{ line: 2, cells: ['A', 'Ada', 'ada@x.org', 'n'] }],
    };

    const built = await buildImportRows(
      table,
      [fieldRole(7), Name, Email, Ignore],
      Fields,
    );

    expect(built.rows).toEqual([
      { name: 'Ada', email: 'ada@x.org', fields: { '7': 'A' } },
    ]);
  });

  test('GIVEN image cells WHEN building rows THEN names found images by their hash and reports the rest', async () => {
    const png = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])],
      'ana.png',
      { type: 'image/png' },
    );
    const text = new File(['not an image'], 'bob.png', { type: 'image/png' });
    const images = await indexImages([png, text]);
    const table = {
      headers: ['n', 'e', 'Foto'],
      rows: [
        { line: 2, cells: ['Ana', 'a@x.org', 'fotos/ANA.png'] },
        { line: 3, cells: ['Bob', 'b@x.org', 'bob.png'] },
        { line: 4, cells: ['Cy', 'c@x.org', 'cy.png'] },
        { line: 5, cells: ['Dee', 'd@x.org', ''] },
      ],
    };

    const built = await buildImportRows(
      table,
      [Name, Email, fieldRole(8)],
      Fields,
      images,
    );

    const [ana, bob, cy, dee] = built.rows;
    expect(ana?.fields?.['8']).toMatch(/^[0-9a-f]{64}\.png$/);
    expect([...built.uploads.values()]).toEqual([png]);
    expect(bob?.fileErrors).toEqual({ '8': FieldValueErrorEnum.ImageInvalid });
    expect(cy?.fileErrors).toEqual({ '8': FieldValueErrorEnum.ImageNotFound });
    expect(dee).toEqual({ name: 'Dee', email: 'd@x.org', fields: { '8': '' } });
  });

  test('GIVEN two images with the same name WHEN building rows THEN reports the cell as ambiguous', async () => {
    const images = await indexImages([
      new File(['a'], 'ana.png'),
      new File(['b'], 'ANA.png'),
    ]);
    const table = {
      headers: ['n', 'e', 'Foto'],
      rows: [{ line: 2, cells: ['Ana', 'a@x.org', 'ana.png'] }],
    };

    const built = await buildImportRows(
      table,
      [Name, Email, fieldRole(8)],
      Fields,
      images,
    );

    expect(built.rows[0]?.fileErrors).toEqual({
      '8': FieldValueErrorEnum.ImageAmbiguous,
    });
  });

  test.each([
    [[Name, Email], true],
    [[Name, Ignore], false],
    [[Name, Name, Email], false],
  ])('GIVEN the roles %j WHEN checking THEN returns %s', (roles, expected) => {
    expect(hasRequiredColumns(roles)).toBe(expected);
  });
});

describe('indexImages', () => {
  test('GIVEN a ZIP with images, macOS files and other files WHEN indexing THEN keeps only the images, by file name', async () => {
    const zip = zipSync({
      'fotos/Ana.PNG': new Uint8Array([1]),
      'fotos/bob.jpeg': new Uint8Array([2]),
      '__MACOSX/fotos/._Ana.PNG': new Uint8Array([3]),
      'fotos/.hidden.png': new Uint8Array([4]),
      'notes.txt': new Uint8Array([5]),
    });

    const images = await indexImages([
      new File([zip as Uint8Array<ArrayBuffer>], 'fotos.zip'),
      new File(['x'], 'readme.md'),
    ]);

    expect([...images.keys()].sort()).toEqual(['ana.png', 'bob.jpeg']);
    expect(images.get('bob.jpeg')?.[0]?.type).toBe('image/jpeg');
  });
});
