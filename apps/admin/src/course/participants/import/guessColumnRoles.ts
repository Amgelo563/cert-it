import {
  type CourseFieldSummary,
  type CourseFieldType,
  CourseFieldTypeEnum,
  dateOrderOf,
  fieldLabelKey,
  type Locale,
  parseFieldCell,
} from '@cert-it/shared';
import { type ColumnRole, ColumnRoleEnum, fieldRole } from './ColumnRoleEnum';
import type { CsvTable } from './CsvTable';

// compared without case, accents, spaces or punctuation
const NameHeaders = new Set([
  'name',
  'fullname',
  'participant',
  'student',
  'nombre',
  'nombres',
  'nombrecompleto',
  'nombresyapellidos',
  'apellidosynombres',
  'participante',
  'alumno',
  'estudiante',
]);

const EmailHeaders = new Set([
  'email',
  'mail',
  'emailaddress',
  'correo',
  'correoelectronico',
  'direcciondecorreo',
]);

const ImageFile = /\.(png|jpe?g)$/i;

/**
 * Returns the role each header most likely has: the first name and email headers found, the course's fields by their label, and the rest as new fields.
 *
 * @param fields The course's fields, each matched to at most one column.
 */
export function guessColumnRoles(
  headers: readonly string[],
  fields: readonly CourseFieldSummary[] = [],
): ColumnRole[] {
  const keys = headers.map(toKey);
  const name = keys.findIndex((key) => NameHeaders.has(key));
  const email = keys.findIndex((key) => EmailHeaders.has(key));
  const unmatched = new Map(
    fields.map((field) => [fieldLabelKey(field.label), field]),
  );

  return headers.map((header, index) => {
    if (index === name) return ColumnRoleEnum.Name;
    if (index === email) return ColumnRoleEnum.Email;
    if (keys[index] === '') return ColumnRoleEnum.Ignore;

    const label = fieldLabelKey(header);
    const field = unmatched.get(label);
    if (!field) return ColumnRoleEnum.New;
    unmatched.delete(label);
    return fieldRole(field.id);
  });
}

/** Returns the type a new field likely has from a column's cells: images, numbers, dates or yes and no, else text. */
export function guessFieldType(
  table: CsvTable,
  index: number,
  locale: Locale,
): CourseFieldType {
  const cells = table.rows
    .map((row) => row.cells[index]?.trim() ?? '')
    .filter((cell) => cell !== '');
  if (cells.length === 0) return CourseFieldTypeEnum.Text;
  if (cells.every((cell) => ImageFile.test(cell))) {
    return CourseFieldTypeEnum.Image;
  }

  const options = { dateOrder: dateOrderOf(locale) };
  const fits = (type: CourseFieldType) =>
    cells.every((cell) => 'value' in parseFieldCell(type, cell, options));
  for (const type of [
    CourseFieldTypeEnum.Number,
    CourseFieldTypeEnum.Date,
    CourseFieldTypeEnum.Boolean,
  ]) {
    if (fits(type)) return type;
  }
  return CourseFieldTypeEnum.Text;
}

function toKey(header: string): string {
  return header
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
