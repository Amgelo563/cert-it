import { type ColumnRole, ColumnRoleEnum } from './ColumnRoleEnum';

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

/** Returns the role each header most likely has: the first name and email headers found, the rest as extra columns. */
export function guessColumnRoles(headers: readonly string[]): ColumnRole[] {
  const keys = headers.map(toKey);
  const name = keys.findIndex((key) => NameHeaders.has(key));
  const email = keys.findIndex((key) => EmailHeaders.has(key));

  return keys.map((key, index) => {
    if (index === name) return ColumnRoleEnum.Name;
    if (index === email) return ColumnRoleEnum.Email;
    return key === '' ? ColumnRoleEnum.Ignore : ColumnRoleEnum.Extra;
  });
}

function toKey(header: string): string {
  return header
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
