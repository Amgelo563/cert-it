// headers the column guess recognizes, in each language
const Samples: Record<string, string> = {
  es: 'nombre,correo,grupo\nAna Torres,ana@ejemplo.com,A\nBruno Díaz,bruno@ejemplo.com,B\n',
  en: 'name,email,group\nAna Torres,ana@example.com,A\nBruno Diaz,bruno@example.com,B\n',
};

/** Saves a small sample CSV in the given language, which Excel opens as UTF-8. */
export function downloadSampleCsv(language: string): void {
  const content = Samples[language] ?? Samples['en'] ?? '';
  // the BOM tells Excel the file is UTF-8
  const blob = new Blob([`﻿${content}`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'participants-sample.csv';
  link.click();
  URL.revokeObjectURL(url);
}
