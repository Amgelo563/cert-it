import type { Template } from '@pdfme/common';
import { describe, expect, test } from 'vite-plus/test';
import { nameNewField } from '../../../../src/course/template/designer/nameNewField';

const BaseNames = {
  participantName: 'Nombre',
  issueDate: 'Fecha',
  qrcode: 'QR',
};

function template(...fields: [name: string, type: string][]): Template {
  return {
    basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
    schemas: [
      fields.map(([name, type]) => ({
        name,
        type,
        position: { x: 0, y: 0 },
        width: 10,
        height: 10,
      })),
    ],
  };
}

describe('nameNewField', () => {
  test('GIVEN a field just added with the default name WHEN naming THEN names it after its type', () => {
    const result = nameNewField(
      template(['QR', 'qrcode'], ['campo2', 'participantName']),
      new Set(['QR']),
      BaseNames,
    );

    expect(result?.name).toBe('Nombre');
    expect(result?.template.schemas[0]?.map((field) => field.name)).toEqual([
      'QR',
      'Nombre',
    ]);
  });

  test('GIVEN a type already placed WHEN naming THEN adds the next free number', () => {
    const result = nameNewField(
      template(
        ['Nombre', 'participantName'],
        ['Nombre 2', 'participantName'],
        ['field3', 'participantName'],
      ),
      new Set(['Nombre', 'Nombre 2']),
      BaseNames,
    );

    expect(result?.name).toBe('Nombre 3');
  });

  test('GIVEN a rename typed by the editor WHEN naming THEN leaves it', () => {
    const result = nameNewField(
      template(['campo7', 'participantName']),
      new Set(['Nombre']),
      BaseNames,
    );

    expect(result).toBeNull();
  });

  test('GIVEN a field of a type without a name WHEN naming THEN leaves it', () => {
    const result = nameNewField(
      template(['field1', 'text']),
      new Set(),
      BaseNames,
    );

    expect(result).toBeNull();
  });
});
