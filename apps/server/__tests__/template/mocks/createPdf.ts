import { PDFDocument } from '@pdfme/pdf-lib';

/** Returns the bytes of a blank PDF with the given number of pages. */
export async function createPdf(pages = 1): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let page = 0; page < pages; page += 1) document.addPage();
  return document.save();
}
