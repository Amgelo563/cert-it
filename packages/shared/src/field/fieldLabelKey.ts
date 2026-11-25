/** Returns a field label as labels are compared: without case, accents or surrounding spaces. */
export function fieldLabelKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
