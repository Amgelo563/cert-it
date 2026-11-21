import {
  TemplateFieldTypeEnum,
  type TemplateTextFieldType,
} from '@cert-it/shared';
import type {
  Plugin,
  Plugins,
  PropPanel,
  PropPanelSchema,
  Schema,
} from '@pdfme/common';
import { barcodes, text } from '@pdfme/schemas';
import { IssueDateIcon, ParticipantNameIcon, QrCodeIcon } from './fieldIcons';

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
type PanelSchema = Record<string, PropPanelSchema>;

// inline markdown needs fonts we don't manage; overflow has no use here
const HiddenTextControls = [
  'useInlineMarkdown',
  'fontVariantFallback',
  'fontVariants',
  'overflow',
];

// text decorations a certificate has no use for
const HiddenFormatButtons = new Set(['strikethrough', 'underline']);

// form flags pdfme adds to every field; certificates have no form to fill
const HiddenFieldFlags: PanelSchema = {
  editable: { type: 'boolean', hidden: true },
  required: { type: 'boolean', hidden: true },
};

// pdfme puts our panel entries after its own, so same keys replace them
function trimPanel(
  base: TextPropPanel,
  trim: (schema: PanelSchema) => void = () => {},
): TextPropPanel['schema'] {
  return (props) => {
    const schema: PanelSchema = {
      ...(typeof base.schema === 'function' ? base.schema(props) : base.schema),
      ...HiddenFieldFlags,
    };
    trim(schema);
    return schema;
  };
}

type ButtonGroup = { buttons?: { key: string }[] };

function withoutFormatButtons(formatter: PropPanelSchema): PropPanelSchema {
  const { buttons } = formatter as ButtonGroup;
  return {
    ...formatter,
    buttons: buttons?.filter(({ key }) => !HiddenFormatButtons.has(key)),
  };
}

/** Returns the field types editors can place, keyed by their sidebar label. Values are bound to fields by type, so names and repeats are free. */
export function createFieldPlugins(options: FieldPluginsOptions): Plugins {
  const { labels, samples, withText } = options;
  const qrcodeBase = barcodes.qrcode.propPanel as TextPropPanel;
  const qrcode: Plugin<Schema> = {
    ...(barcodes.qrcode as Plugin<Schema>),
    icon: QrCodeIcon,
    propPanel: {
      ...qrcodeBase,
      schema: trimPanel(qrcodeBase),
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
      ParticipantNameIcon,
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
      IssueDateIcon,
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

// pdfme's text field with our type, sample, icon and font names
function textField(
  type: TemplateTextFieldType,
  content: string,
  icon: string,
  fontLabel: (sha256: string) => string,
  defaults: Record<string, unknown>,
): Plugin<Schema> {
  const base = text.propPanel as unknown as TextPropPanel;

  return {
    ...(text as unknown as Plugin<Schema>),
    icon,
    propPanel: {
      ...base,
      schema: trimPanel(base, (schema) => {
        for (const key of HiddenTextControls) delete schema[key];
        if (schema['formatter'])
          schema['formatter'] = withoutFormatButtons(schema['formatter']);
        if (schema['fontName'])
          schema['fontName'] = withFontLabels(schema['fontName'], fontLabel);
      }),
      defaultSchema: { ...base.defaultSchema, ...defaults, type, content },
    },
  };
}
