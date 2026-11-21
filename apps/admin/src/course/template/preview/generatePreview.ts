import type { Font, Plugins, Template } from '@pdfme/common';
import { pdf2img } from '@pdfme/converter';
import { generate } from '@pdfme/generator';

/** A generated preview: the certificate's PDF and its page as a PNG. */
export type GeneratedPreview = {
  pdf: Blob;
  image: Blob;
};

type GeneratePreviewOptions = {
  /** The template with its base PDF bytes. */
  template: Template;
  /** The pdfme inputs, one per document; only the first is drawn. */
  inputs: Record<string, string>[];
  /** Fonts by the name text fields use; empty when none is loaded. */
  fonts: Font;
  plugins: Plugins;
};

// sharp enough for a modal that fills most of the screen
const PageScale = 2;

const PdfType = 'application/pdf';

/** Generates a certificate in the browser, as issuing does on the server, and draws its page. */
export async function generatePreview(
  options: GeneratePreviewOptions,
): Promise<GeneratedPreview> {
  const { template, inputs, fonts, plugins } = options;
  const pdf = await generate({
    template,
    inputs,
    plugins,
    options: Object.keys(fonts).length > 0 ? { font: fonts } : {},
  });
  // the PDF goes to a worker, which may take its buffer
  const [page] = await pdf2img(pdf.slice(), {
    scale: PageScale,
    range: { end: 1 },
  });
  if (!page) throw new Error('The preview has no pages');

  return {
    pdf: new Blob([pdf], { type: PdfType }),
    image: new Blob([page], { type: 'image/png' }),
  };
}

/** Returns the pdfme inputs that print each field's own sample, as the canvas shows it. */
export function sampleInputs(
  schemas: Template['schemas'],
): Record<string, string>[] {
  return [
    Object.fromEntries(
      schemas.flat().map((field) => [field.name, String(field.content ?? '')]),
    ),
  ];
}
