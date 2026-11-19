// The generator child process of the bench: renders one certificate per
// generate() call and writes each to disk, like the issuing job will (S1).
//
// TODO(P4): replace the inline template with the real generator entry from
// src/generator/, so the bench measures the real code path.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDefaultFont } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { barcodes, text } from '@pdfme/schemas';

const { count, basePdfPath, outDir, nameFontPath } = JSON.parse(
  process.argv[2],
);

const Alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const Names = [
  'Ana Pérez',
  'José Ñúñez Gutiérrez',
  'María Fernanda de los Ángeles Rodríguez Villanueva-Castañeda',
  'Li Wei',
  'Jürgen Müller',
  'Zoë Ellington-Brown',
];

let peak = 0;
const sample = () => {
  peak = Math.max(peak, process.memoryUsage.rss());
};
setInterval(sample, 25).unref();

const font = {
  ...getDefaultFont(),
  ...(nameFontPath ? { Name: { data: readFileSync(nameFontPath) } } : {}),
};
const nameFont = nameFontPath ? 'Name' : Object.keys(getDefaultFont())[0];

const textField = {
  type: 'text',
  lineHeight: 1,
  characterSpacing: 0,
  backgroundColor: '',
  verticalAlignment: 'middle',
};
const template = {
  basePdf: readFileSync(basePdfPath),
  schemas: [
    [
      {
        ...textField,
        name: 'name',
        position: { x: 30, y: 85 },
        width: 237,
        height: 22,
        fontName: nameFont,
        fontSize: 36,
        alignment: 'center',
        fontColor: '#1a1a1a',
        dynamicFontSize: { min: 14, max: 36, fit: 'horizontal' },
      },
      {
        ...textField,
        name: 'date',
        position: { x: 30, y: 150 },
        width: 100,
        height: 10,
        fontSize: 14,
        alignment: 'left',
        fontColor: '#333333',
      },
      {
        name: 'qr',
        type: 'qrcode',
        position: { x: 240, y: 160 },
        width: 35,
        height: 35,
        backgroundColor: '#ffffff',
        barColor: '#000000',
      },
    ],
  ],
};
const plugins = { text, qrcode: barcodes.qrcode };

function createCode() {
  let code = '';
  for (let i = 0; i < 10; i += 1) {
    code += Alphabet[Math.floor(Math.random() * Alphabet.length)];
  }
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
}

let bytes = 0;
for (let i = 0; i < count; i += 1) {
  const code = createCode();
  const pdf = await generate({
    template,
    inputs: [
      {
        name: Names[i % Names.length],
        date: '19 de noviembre de 2026',
        qr: `https://certs.example.org/c/${code}`,
      },
    ],
    options: { font },
    plugins,
  });
  writeFileSync(join(outDir, `${code}.pdf`), pdf);
  bytes += pdf.byteLength;
  sample();

  if ((i + 1) % 100 === 0) process.send({ type: 'progress', done: i + 1 });
}

process.send({ type: 'done', bytes, peakRss: peak });
