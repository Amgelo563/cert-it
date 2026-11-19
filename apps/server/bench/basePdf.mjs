// Writes the bench's base PDF: A4 landscape with one full-page image of random
// RGB pixels, which doesn't compress, so the file size is set by its side.
// Runs in its own process, so the bench's app process never loads pdfme.
//
// Usage: node basePdf.mjs <side in pixels> <output path>
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { generate } from '@pdfme/generator';
import { image } from '@pdfme/schemas';

const [side, outputPath] = [Number(process.argv[2]), process.argv[3]];

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function createPng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const rows = [];
  for (let y = 0; y < side; y += 1) {
    rows.push(Buffer.from([0]), randomBytes(side * 3));
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const pdf = await generate({
  template: {
    basePdf: { width: 297, height: 210, padding: [0, 0, 0, 0] },
    schemas: [
      [
        {
          name: 'background',
          type: 'image',
          position: { x: 0, y: 0 },
          width: 297,
          height: 210,
        },
      ],
    ],
  },
  inputs: [
    { background: `data:image/png;base64,${createPng().toString('base64')}` },
  ],
  plugins: { image },
});
writeFileSync(outputPath, pdf);
