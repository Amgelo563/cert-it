/** What a certificate prints for one course field: text, a boolean whose wording each template field sets, or an image. */
export type TemplateFieldValue =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'boolean'; readonly value: boolean }
  | {
      readonly kind: 'image';
      /** The image as a data: URL, as pdfme draws it. */
      readonly dataUrl: string;
    };

/** What a certificate prints for each course field with a value, by field ID. */
export type TemplateFieldValues = Readonly<Record<string, TemplateFieldValue>>;
