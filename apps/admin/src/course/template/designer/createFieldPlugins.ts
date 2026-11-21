import {
  TemplateFieldTypeEnum,
  type TemplateTextFieldType,
} from '@cert-it/shared';
import type { Plugin, Plugins, PropPanel, Schema } from '@pdfme/common';
import { barcodes, text } from '@pdfme/schemas';

/** A text, one per field type, such as its label or its sample value. */
type PerFieldType = Readonly<Record<TemplateTextFieldType | 'qrcode', string>>;

type FieldPluginsOptions = {
  /** Labels shown in the Designer's sidebar. */
  labels: PerFieldType;
  /** What each new field shows until real values replace it. */
  samples: PerFieldType;
  /** Whether name and date fields can be placed: they need a font loaded. */
  withText: boolean;
  /** Returns the name shown for a font, given the SHA-256 fields use for it. */
  fontLabel: (sha256: string) => string;
};

type TextPropPanel = PropPanel<Schema>;

// controls for inline markdown, which needs bold and italic fonts we don't manage
const HiddenTextControls = [
  'useInlineMarkdown',
  'fontVariantFallback',
  'fontVariants',
];

/** Returns the field types editors can place, keyed by their sidebar label. Values are bound to fields by type, so names and repeats are free. */
export function createFieldPlugins(options: FieldPluginsOptions): Plugins {
  const { labels, samples, withText } = options;
  const qrcode: Plugin<Schema> = {
    ...(barcodes.qrcode as Plugin<Schema>),
    propPanel: {
      ...(barcodes.qrcode.propPanel as TextPropPanel),
      defaultSchema: {
        ...barcodes.qrcode.propPanel.defaultSchema,
        // must stay qrcode: the pdfme barcode plugin picks its encoder from the type
        type: TemplateFieldTypeEnum.QrCode,
        content: samples.qrcode,
      },
    },
  };
  if (!withText) return { [labels.qrcode]: qrcode };

  return {
    [labels.participantName]: textField(
      TemplateFieldTypeEnum.ParticipantName,
      samples.participantName,
      options.fontLabel,
      {
        width: 180,
        height: 20,
        fontSize: 32,
        alignment: 'center',
        verticalAlignment: 'middle',
        // long names shrink to fit instead of overflowing
        dynamicFontSize: { min: 12, max: 32, fit: 'horizontal' },
      },
    ),
    [labels.issueDate]: textField(
      TemplateFieldTypeEnum.IssueDate,
      samples.issueDate,
      options.fontLabel,
      { width: 80, height: 10, fontSize: 14 },
    ),
    [labels.qrcode]: qrcode,
  };
}

type FontSelect = {
  placeholder?: unknown;
  props?: { options?: { value: string }[] };
};

// pdfme names fonts by their key, which is a hash here
function withFontLabels<T>(
  widget: T,
  fontLabel: (sha256: string) => string,
): T {
  const select = widget as FontSelect;

  return {
    ...select,
    ...(typeof select.placeholder === 'string'
      ? { placeholder: fontLabel(select.placeholder) }
      : {}),
    props: {
      ...select.props,
      options: select.props?.options?.map(({ value }) => ({
        value,
        label: fontLabel(value),
      })),
    },
  } as T;
}

// pdfme's text field with our type, sample and font names
function textField(
  type: TemplateTextFieldType,
  content: string,
  fontLabel: (sha256: string) => string,
  defaults: Record<string, unknown>,
): Plugin<Schema> {
  const base = text.propPanel as unknown as TextPropPanel;

  return {
    ...(text as unknown as Plugin<Schema>),
    propPanel: {
      ...base,
      schema: (props) => {
        const schema = {
          ...(typeof base.schema === 'function'
            ? base.schema(props)
            : base.schema),
        };
        for (const key of HiddenTextControls) delete schema[key];
        const fontName = schema['fontName'];
        if (fontName) schema['fontName'] = withFontLabels(fontName, fontLabel);
        return schema;
      },
      defaultSchema: { ...base.defaultSchema, ...defaults, type, content },
    },
  };
}
