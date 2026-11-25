import {
  type TemplateContent,
  type TemplateFieldValues,
  TemplateFieldTypeEnum,
  type TemplateValues,
  buildTemplateInputs,
  listCourseFieldIds,
  parseCourseFieldTemplateType,
} from '@cert-it/shared';
import type { Font, Plugin, Plugins, Schema, Template } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { barcodes, image, text } from '@pdfme/schemas';
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
  /** The plugins of the template's field types. */
  plugins: Plugins;
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

  protected readonly plugins: Plugins;

  constructor(options: CertificateRendererOptions) {
    this.template = options.template;
    this.fonts = options.fonts;
    this.glyphs = options.glyphs;
    this.plugins = options.plugins;
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
      plugins: CertificateRenderer.pluginsFor(template),
    });
  }

  /** Returns the IDs of the course fields the template prints. */
  public getCourseFieldIds(): ReadonlySet<number> {
    return listCourseFieldIds(this.template);
  }

  /** Returns what each field of the template prints, by its name. */
  public inputsOf(
    values: TemplateValues,
    fields: TemplateFieldValues = {},
  ): Record<string, string> {
    return buildTemplateInputs(this.template.schemas, values, fields)[0] ?? {};
  }

  /** Returns the text fields whose text has characters their font can't draw; empty when the certificate can be rendered. */
  public findMissing(
    inputs: Readonly<Record<string, string>>,
  ): MissingGlyphs[] {
    return this.glyphs.findMissing(inputs);
  }

  /** Renders one certificate as PDF bytes, from {@link CertificateRenderer.inputsOf}. */
  public async render(
    inputs: Readonly<Record<string, string>>,
  ): Promise<Uint8Array> {
    return generate({
      template: this.template,
      inputs: [{ ...inputs }],
      plugins: this.plugins,
      options: this.fonts ? { font: this.fonts } : {},
    });
  }

  // each course field has a type of its own, so its plugin is added by the type
  protected static pluginsFor(template: TemplateContent): Plugins {
    const plugins: Plugins = { ...CertificateRenderer.Plugins };
    for (const field of template.schemas.flat()) {
      const course = parseCourseFieldTemplateType(field.type);
      if (!course || plugins[field.type]) continue;
      plugins[field.type] =
        course.kind === TemplateFieldTypeEnum.FieldText
          ? CertificateRenderer.textPlugin(field.type)
          : CertificateRenderer.imagePlugin(field.type);
    }
    return plugins;
  }

  protected static imagePlugin(type: string): Plugin<Schema> {
    const plugin = image as unknown as Plugin<Schema>;

    return {
      ...plugin,
      propPanel: {
        ...plugin.propPanel,
        defaultSchema: {
          ...plugin.propPanel.defaultSchema,
          type,
        },
      },
    };
  }

  protected static textPlugin(type: string): Plugin<Schema> {
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
