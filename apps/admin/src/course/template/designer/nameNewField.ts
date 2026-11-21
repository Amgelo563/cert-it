import type { Template } from '@pdfme/common';

// pdfme names a new field as one word and a number, such as field3 or campo3
const DefaultName = /^\S+?\d+$/u;

/**
 * Returns the template with a just-added field renamed after its type, such as `Nombre` then `Nombre 2`, or null if the change added no field with pdfme's default name.
 *
 * @param previousNames Names of the fields before the change.
 * @param baseNames Name for each field type.
 */
export function nameNewField(
  template: Template,
  previousNames: ReadonlySet<string>,
  baseNames: Readonly<Record<string, string>>,
): { template: Template; name: string } | null {
  const fields = template.schemas.flat();
  // edits keep the count, so a rename typed by the editor is never touched
  if (fields.length !== previousNames.size + 1) return null;

  const added = fields.find(
    (field) => !previousNames.has(field.name) && DefaultName.test(field.name),
  );
  const base = added && baseNames[added.type];
  if (!added || !base) return null;

  const taken = new Set(fields.map((field) => field.name));
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base} ${n}`;

  return {
    name,
    template: {
      ...template,
      schemas: template.schemas.map((page) =>
        page.map((field) => (field === added ? { ...field, name } : field)),
      ),
    },
  };
}
