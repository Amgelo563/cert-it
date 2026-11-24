import {
  type TemplateContent,
  TemplateFieldTypeEnum,
  type TemplateTextFieldType,
  type TemplateValues,
  buildTemplateInputs,
} from '@cert-it/shared';
import type { Font, Plugin, Plugins, Schema, Template } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { barcodes, text } from '@pdfme/schemas';
import {
  type MissingGlyphs,
  TemplateGlyphChecker,
} from '../../template/glyph/TemplateGlyphChecker';
import { listTextFields } from '../../template/TemplateTextField';

type CertificateRendererOptions = {
  /** The template with its base PDF bytes. */
  template: Template;
  /** Fonts by the SHA-256 text fields name them with, or null when there are no text fields. */
  fonts: Font | null;
  glyphs: TemplateGlyphChecker;
};

/** What a renderer reads to load a template version. */
export type CertificateRendererFiles = {
  /** Returns the bytes of a stored font, given its SHA-256. */
  readFont(sha256: string): Promise<Uint8Array<ArrayBuffer>>;
};

/** Renders the certificates of one template version, as the admin preview does in the browser. */
export class CertificateRenderer {
  // pdfme picks the plugin of a field by its type, so the text plugin is registered under ours
  protected static readonly Plugins: Plugins = {
    [TemplateFieldTypeEnum.ParticipantName]: CertificateRenderer.textPlugin(
      TemplateFieldTypeEnum.ParticipantName,
    ),
    [TemplateFieldTypeEnum.IssueDate]: CertificateRenderer.textPlugin(
      TemplateFieldTypeEnum.IssueDate,
    ),
    [TemplateFieldTypeEnum.QrCode]: barcodes.qrcode as Plugin<Schema>,
  };

  protected readonly template: Template;

  protected readonly fonts: Font | null;

  protected readonly glyphs: TemplateGlyphChecker;

  constructor(options: CertificateRendererOptions) {
    this.template = options.template;
    this.fonts = options.fonts;
    this.glyphs = options.glyphs;
  }

  /**
   * Loads a template and the fonts of its text fields, reading each font once.
   *
   * @throws {Error} If a font can't be read or parsed.
   */
  public static async load(
    template: TemplateContent,
    basePdf: Uint8Array<ArrayBuffer>,
    files: CertificateRendererFiles,
  ): Promise<CertificateRenderer> {
    const bytes = new Map<string, Uint8Array<ArrayBuffer>>();
    for (const { fontName } of listTextFields(template)) {
      if (!bytes.has(fontName))
        bytes.set(fontName, await files.readFont(fontName));
    }

    const glyphs = await TemplateGlyphChecker.load(template, (sha256) =>
      Promise.resolve(bytes.get(sha256)!),
    );
    // pdfme needs exactly one fallback font
    const fonts: Font = Object.fromEntries(
      [...bytes].map(([sha256, data], index) => [
        sha256,
        { data, fallback: index === 0 },
      ]),
    );

    return new CertificateRenderer({
      template: { ...template, basePdf } as Template,
      fonts: bytes.size > 0 ? fonts : null,
      glyphs,
    });
  }

  /** Returns the text fields whose value has characters their font can't draw; empty when the certificate can be rendered. */
  public findMissing(values: TemplateValues): MissingGlyphs[] {
    return this.glyphs.findMissing(values);
  }

  /** Renders one certificate as PDF bytes. */
  public async render(values: TemplateValues): Promise<Uint8Array> {
    return generate({
      template: this.template,
      inputs: buildTemplateInputs(this.template.schemas, values),
      plugins: CertificateRenderer.Plugins,
      options: this.fonts ? { font: this.fonts } : {},
    });
  }

  protected static textPlugin(type: TemplateTextFieldType): Plugin<Schema> {
    const plugin = text as unknown as Plugin<Schema>;

    return {
      ...plugin,
      propPanel: {
        ...plugin.propPanel,
        defaultSchema: { ...plugin.propPanel.defaultSchema, type },
      },
    };
  }
}
