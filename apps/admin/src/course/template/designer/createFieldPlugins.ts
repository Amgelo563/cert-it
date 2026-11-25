import {
  courseFieldTemplateType,
  type CourseFieldSummary,
  parseCourseFieldTemplateType,
  CourseFieldTypeEnum,
  type TemplateBuiltInFieldType,
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
import { barcodes, image, text } from '@pdfme/schemas';
import {
  CourseFieldIcon,
  ImageFieldIcon,
  IssueDateIcon,
  ParticipantNameIcon,
  QrCodeIcon,
} from './fieldIcons';

/** A text, one per field type that's the same for every course, such as its label or its sample value. */
type PerFieldType = Readonly<Record<TemplateBuiltInFieldType, string>>;

/** A grey box, which image fields show until a participant's image replaces it. */
export const ImagePlaceholder =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4e/8xAAU8AqAg/pEyAAAAAElFTkSuQmCC';

type FieldPluginsOptions = {
  /** Labels shown in the Designer's sidebar. */
  labels: PerFieldType;
  /** What each new field shows until real values replace it. */
  samples: PerFieldType;
  /** Whether name and date fields can be placed: they need a font loaded. */
  withText: boolean;
  /** Returns the name shown for a font, given the SHA-256 fields use for it. */
  fontLabel: (sha256: string) => string;
  /** The course's fields, one entry each in the sidebar. */
  courseFields?: readonly CourseFieldSummary[];
  /** Returns what a new field of a course field shows until real values replace it. */
  courseFieldSample?: (field: CourseFieldSummary) => string;
  /** Titles of the wording a boolean field prints. */
  booleanLabels?: { trueText: string; falseText: string };
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

type PanelProps = Parameters<Extract<TextPropPanel['schema'], Function>>[0];

// pdfme puts our panel entries after its own, so same keys replace them
function trimPanel(
  base: TextPropPanel,
  trim: (schema: PanelSchema, props: PanelProps) => void = () => {},
): TextPropPanel['schema'] {
  return (props) => {
    const schema: PanelSchema = {
      ...(typeof base.schema === 'function' ? base.schema(props) : base.schema),
      ...HiddenFieldFlags,
    };
    trim(schema, props);
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
  const fields = courseFieldPlugins(options);
  if (!withText) return { [labels.qrcode]: qrcode, ...fields.images };

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
    ...fields.texts,
    ...fields.images,
  };
}

// one entry per course field, keyed by its label; images need no font, so they're apart
function courseFieldPlugins(options: FieldPluginsOptions): {
  texts: Plugins;
  images: Plugins;
} {
  const { courseFields = [], courseFieldSample = (field) => field.label } =
    options;
  const types = new Map(courseFields.map((field) => [field.id, field.type]));
  const texts: Plugins = {};
  const images: Plugins = {};
  // a field's label may match a built-in one, which keeps its own
  const taken = new Set(Object.values(options.labels));
  const keyOf = (field: CourseFieldSummary) => {
    let key = field.label;
    for (let n = 2; taken.has(key); n += 1) key = `${field.label} (${n})`;
    taken.add(key);
    return key;
  };

  for (const field of courseFields) {
    if (field.type === CourseFieldTypeEnum.Image) {
      images[keyOf(field)] = imageField(field);
      continue;
    }
    texts[keyOf(field)] = textField(
      courseFieldTemplateType(TemplateFieldTypeEnum.FieldText, field.id),
      courseFieldSample(field),
      CourseFieldIcon,
      options.fontLabel,
      { width: 80, height: 10, fontSize: 14 },
      (schema, props) => {
        // only booleans print a wording of their own
        const id = parseCourseFieldTemplateType(
          props.activeSchema.type,
        )?.fieldId;
        if (id === undefined || types.get(id) !== CourseFieldTypeEnum.Boolean) {
          return;
        }
        const labels = options.booleanLabels;
        schema['trueText'] = {
          title: labels?.trueText ?? 'trueText',
          type: 'string',
          widget: 'input',
          span: 12,
        };
        schema['falseText'] = {
          title: labels?.falseText ?? 'falseText',
          type: 'string',
          widget: 'input',
          span: 12,
        };
      },
    );
  }
  return { texts, images };
}

// pdfme's image field with our type, drawing a placeholder until a value replaces it
function imageField(field: CourseFieldSummary): Plugin<Schema> {
  const base = image.propPanel as unknown as TextPropPanel;

  return {
    ...(image as unknown as Plugin<Schema>),
    icon: ImageFieldIcon,
    propPanel: {
      ...base,
      schema: trimPanel(base),
      defaultSchema: {
        ...base.defaultSchema,
        type: courseFieldTemplateType(
          TemplateFieldTypeEnum.FieldImage,
          field.id,
        ),
        content: ImagePlaceholder,
        width: 30,
        height: 30,
      },
    },
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
  extend: (schema: PanelSchema, props: PanelProps) => void = () => {},
): Plugin<Schema> {
  const base = text.propPanel as unknown as TextPropPanel;

  return {
    ...(text as unknown as Plugin<Schema>),
    icon,
    propPanel: {
      ...base,
      schema: trimPanel(base, (schema, props) => {
        extend(schema, props);
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
