/** Texts printed on the sample certificate. */
export type SamplePdfTexts = {
  title: string;
  /** Printed above the participant's name. */
  intro: string;
  /** Printed below the participant's name. */
  outro: string;
};

// A4 landscape, in points
const PageWidth = 842;
const PageHeight = 595;

// rough Helvetica width per point of size, enough to center a line
const AverageCharWidth = 0.52;

/** Returns a one-page A4 landscape PDF to use as a sample base PDF, with a frame and its texts in Helvetica. */
export function createSamplePdf(texts: SamplePdfTexts): ArrayBuffer {
  const content = [
    '0.75 0.79 0.86 RG 2 w 28 28 786 539 re S',
    '0.5 w 40 40 762 515 re S',
    '0.09 0.09 0.11 rg',
    centered(texts.title, 30, 468),
    '0.32 0.32 0.36 rg',
    centered(texts.intro, 14, 382),
    centered(texts.outro, 14, 236),
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PageWidth} ${PageHeight}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];

  // every character is one byte, so string lengths are byte offsets
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const [index, body] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes.buffer;
}

function centered(text: string, size: number, y: number): string {
  const width = text.length * size * AverageCharWidth;
  const x = Math.max(48, (PageWidth - width) / 2);
  return `BT /F1 ${size} Tf ${x.toFixed(1)} ${y} Td (${escape(text)}) Tj ET`;
}

// Latin-1 characters as octal escapes, as WinAnsi encodes them; others as a question mark
function escape(text: string): string {
  let escaped = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char === '(' || char === ')' || char === '\\') escaped += `\\${char}`;
    else if (code >= 32 && code < 127) escaped += char;
    else if (code >= 160 && code < 256) escaped += `\\${code.toString(8)}`;
    else escaped += '?';
  }
  return escaped;
}
