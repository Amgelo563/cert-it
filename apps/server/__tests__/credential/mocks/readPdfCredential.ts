import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
} from '@pdfme/pdf-lib';

/** Returns the first file embedded in a PDF, with its name, or null if it has none. */
export async function readPdfCredential(
  pdf: Uint8Array,
): Promise<{ name: string; jwt: string } | null> {
  const document = await PDFDocument.load(pdf);
  const list = document.catalog
    .lookupMaybe(PDFName.of('Names'), PDFDict)
    ?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)
    ?.lookupMaybe(PDFName.of('Names'), PDFArray);
  if (!list) return null;

  const name = list.lookup(0, PDFString, PDFHexString).decodeText();
  const stream = list
    .lookup(1, PDFDict)
    .lookup(PDFName.of('EF'), PDFDict)
    .lookup(PDFName.of('F'));
  if (!(stream instanceof PDFRawStream)) return null;
  const bytes = decodePDFRawStream(stream).decode();
  return { name, jwt: new TextDecoder().decode(bytes) };
}
