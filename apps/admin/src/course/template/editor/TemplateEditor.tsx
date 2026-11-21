import { GlyphChecker } from '@cert-it/fonts';
import {
  type CourseSummary,
  CourseDateFormatter,
  type FontSummary,
  type SaveTemplateRequest,
} from '@cert-it/shared';
import type { Font, Template } from '@pdfme/common';
import '@mantine/dropzone/styles.css';
import {
  Alert,
  Button,
  FileButton,
  Group,
  List,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconDeviceFloppy,
  IconFileTypePdf,
  IconInfoCircle,
  IconTypography,
} from '@tabler/icons-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';
import { LeaveGuard } from '../../../app/router/LeaveGuard';
import { FontsModal } from './fonts/FontsModal';
import { createFieldPlugins } from '../designer/createFieldPlugins';
import {
  TemplateDesigner,
  type TemplateDesignerHandle,
} from '../designer/TemplateDesigner';
import {
  findGlyphWarnings,
  isTextField,
  type GlyphWarning,
  withFontNames,
} from './templateFields';

/** A base PDF the editor holds: its hash for saving, its bytes for the canvas. */
export type EditorBasePdf = {
  sha256: string;
  bytes: ArrayBuffer;
};

/** The fields of a template, without its base PDF. */
export type TemplateEditorContent = Pick<Template, 'schemas'>;

/** What the editor starts from: the latest version, or nothing yet. */
export type TemplateEditorStart = {
  /** Number of the latest version, or null if the course has none. */
  version: number | null;
  content: TemplateEditorContent;
  /** Null until a base PDF is uploaded to a course without a template; the Designer only shows once there is one. */
  basePdf: EditorBasePdf | null;
  /** Font bytes by SHA-256, the name text fields use. */
  fonts: ReadonlyMap<string, ArrayBuffer>;
  /** Names of those fonts, by SHA-256. */
  fontInfo: ReadonlyMap<string, FontSummary>;
};

type TemplateEditorProps = {
  course: CourseSummary;
  start: TemplateEditorStart;
  /** Called after saving a version, such as to refresh the course's counts. */
  onSaved: () => void;
};

type Busy = 'pdf' | 'font' | 'save' | null;

const PdfType = 'application/pdf';

// what new QR fields encode until issuing puts the certificate's own URL there
const SampleCode = 'ABCD-EFGH-JK';

/** The Designer with its toolbar: upload a base PDF, add fonts, and save the canvas as a new version. */
export function TemplateEditor({
  course,
  start,
  onSaved,
}: TemplateEditorProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const designer = useRef<TemplateDesignerHandle>(null);
  const [version, setVersion] = useState(start.version);
  const [content, setContent] = useState(start.content);
  const [basePdf, setBasePdf] = useState(start.basePdf);
  const [fonts, setFonts] = useState(start.fonts);
  const [fontInfo, setFontInfo] = useState(start.fontInfo);
  const [fontsOpen, setFontsOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  // the canvas's fields, and the last saved version as a comparable key
  const [fields, setFields] = useState<Template['schemas'] | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const param = { courseId: String(course.id) };

  // the first font loaded is pdfme's fallback, drawn by fields that name none
  const fallback = fonts.keys().next().value ?? null;
  const named = useMemo(
    () => (fields ? withFontNames(fields, fallback) : null),
    [fields, fallback],
  );

  // a new base PDF counts as a change, even with the same fields
  const currentKey =
    basePdf && named ? `${basePdf.sha256}:${fieldsKeyOf(named)}` : null;
  const changed = currentKey !== null && currentKey !== savedKey;

  // the loaded version is the baseline, as pdfme read it, so its own tidying isn't a change
  const onLoad = (loaded: Template) => {
    setFields(loaded.schemas);
    if (version !== null && basePdf) {
      const key = fieldsKeyOf(withFontNames(loaded.schemas, fallback));
      setSavedKey(`${basePdf.sha256}:${key}`);
    }
  };
  const onChange = (edited: Template) => setFields(edited.schemas);

  const fontOption = useMemo<Font>(
    () =>
      Object.fromEntries(
        [...fonts].map(([sha256, data], index) => [
          sha256,
          { data, fallback: index === 0 },
        ]),
      ),
    [fonts],
  );

  // new names or languages restart the Designer, which keeps its canvas
  const hasFonts = fonts.size > 0;
  const plugins = useMemo(() => {
    const date = new CourseDateFormatter({
      locale: course.locale,
      dateFormat: course.dateFormat,
    }).format(today());

    return createFieldPlugins({
      labels: {
        participantName: t('template.fields.participantName'),
        issueDate: t('template.fields.issueDate'),
        qrcode: t('template.fields.qrcode'),
      },
      samples: {
        participantName: t('template.sampleName'),
        issueDate: date,
        qrcode: new URL(`../c/${SampleCode}`, document.baseURI).href,
      },
      withText: hasFonts,
      fontLabel: (sha256) => fontLabelOf(fontInfo, sha256),
    });
  }, [t, course.locale, course.dateFormat, hasFonts, fontInfo]);

  const fieldNames = useMemo(
    () => ({
      participantName: t('template.fieldNames.participantName'),
      issueDate: t('template.fieldNames.issueDate'),
      qrcode: t('template.fieldNames.qrcode'),
    }),
    [t],
  );

  // a new value only when the base PDF changes, so typing on the canvas never resets it
  const template = useMemo<Template | null>(
    () => (basePdf ? { ...content, basePdf: basePdf.bytes } : null),
    [content, basePdf],
  );

  // parsed once per font, not on every edit
  const checkers = useMemo(
    () =>
      new Map(
        [...fonts].flatMap(([sha256, bytes]) => {
          const checker = GlyphChecker.fromBytes(new Uint8Array(bytes));
          return checker.isOk() ? [[sha256, checker.value] as const] : [];
        }),
      ),
    [fonts],
  );
  const warnings = useMemo<GlyphWarning[]>(
    () => (named ? findGlyphWarnings(named, checkers) : []),
    [named, checkers],
  );

  // true once the task worked; a failure is shown and gives false
  const run = async (
    kind: Exclude<Busy, null>,
    task: () => Promise<void>,
  ): Promise<boolean> => {
    setBusy(kind);
    try {
      await task();
      return true;
    } catch (error) {
      notifications.show({
        color: 'red',
        message: describeApiError(error, i18n),
      });
      return false;
    } finally {
      setBusy(null);
    }
  };

  // keeps the fields placed so far, on the new page
  const uploadPdf = (file: File | null) =>
    file
    && run('pdf', async () => {
      const uploaded = await api.request((routes) =>
        routes.courses[':courseId'].template['base-pdf'].$post(
          { param },
          { headers: { 'Content-Type': PdfType }, init: { body: file } },
        ),
      );
      const bytes = await file.arrayBuffer();
      if (designer.current) setContent(withoutBasePdf(designer.current));
      setBasePdf({ sha256: uploaded.basePdf, bytes });
      notifications.show(
        uploaded.large
          ? {
              color: 'yellow',
              autoClose: false,
              message: t('template.largePdf', {
                size: formatMegabytes(uploaded.bytes, i18n.language),
              }),
            }
          : { color: 'teal', message: t('template.pdfUploaded') },
      );
    });

  // a font joins the Designer only with its bytes, so fields never name one it can't draw
  const loadFont = (font: FontSummary, bytes: ArrayBuffer) => {
    setFontInfo((current) => new Map(current).set(font.sha256, font));
    setFonts((current) =>
      current.has(font.sha256)
        ? current
        : new Map(current).set(font.sha256, bytes),
    );
    notifications.show({
      color: 'teal',
      message: t('template.fontAdded', {
        family: font.family,
        style: font.style,
      }),
    });
  };

  const uploadFont = (file: File) =>
    run('font', async () => {
      const font = await api.request((routes) =>
        routes.fonts.$post(
          {},
          {
            headers: { 'Content-Type': 'application/octet-stream' },
            init: { body: file },
          },
        ),
      );
      loadFont(font, await file.arrayBuffer());
    });

  const addStoredFont = (font: FontSummary) =>
    run('font', async () => {
      const bytes = await api.requestBytes((routes) =>
        routes.fonts[':sha256'].$get({ param: { sha256: font.sha256 } }),
      );
      loadFont(font, bytes);
    });

  // only a font no field draws with: those without one draw with the fallback
  const unloadFont = (font: FontSummary) => {
    const label = `${font.family} ${font.style}`;
    const users = (named ?? [])
      .flat()
      .filter(
        (field) => isTextField(field) && field['fontName'] === font.sha256,
      )
      .map((field) => field.name);
    if (users.length > 0) {
      notifications.show({
        color: 'yellow',
        message: t('template.fontInUse', {
          font: label,
          fields: users.join(', '),
        }),
      });
      return;
    }

    setFonts((current) => {
      const next = new Map(current);
      next.delete(font.sha256);
      return next;
    });
    notifications.show({
      color: 'teal',
      message: t('template.fontRemoved', { font: label }),
    });
  };

  const save = () =>
    basePdf
    && run('save', async () => {
      const sent = {
        schemas: withFontNames(
          withoutBasePdf(designer.current!).schemas,
          fallback,
        ),
      };
      const saved = await api.request((routes) =>
        routes.courses[':courseId'].template.$post({
          param,
          json: {
            basePdf: basePdf.sha256,
            // the server checks every field against its own schema
            template: sent as SaveTemplateRequest['template'],
          },
        }),
      );
      // what was sent is now the baseline, even if the canvas changed meanwhile
      setSavedKey(`${basePdf.sha256}:${fieldsKeyOf(sent.schemas)}`);
      setVersion(saved.version);
      notifications.show({
        color: 'teal',
        message: t('template.saved', { version: saved.version }),
      });
      onSaved();
    });

  // nothing to place fields on until there's a page; clicking it opens the file picker too
  if (!template) {
    return (
      <Dropzone
        onDrop={([file]) => void uploadPdf(file ?? null)}
        onReject={() =>
          notifications.show({
            color: 'red',
            message: t('apiErrors.codes.invalidPdf'),
          })
        }
        accept={{ [PdfType]: ['.pdf'] }}
        maxFiles={1}
        multiple={false}
        loading={busy === 'pdf'}
      >
        <Stack align="center" gap="md" py="xl" mih={240} justify="center">
          <ThemeIcon variant="light" size={48} radius="xl">
            <IconFileTypePdf size={26} stroke={1.5} />
          </ThemeIcon>
          <Stack gap={4} align="center" maw={420}>
            <Text fw={500}>{t('template.emptyTitle')}</Text>
            <Text c="dimmed" size="sm" ta="center">
              {t('template.emptyText')}
            </Text>
          </Stack>
        </Stack>
      </Dropzone>
    );
  }

  return (
    <Stack gap="md">
      <LeaveGuard when={changed} />
      <Group justify="space-between" gap="sm">
        <Text size="sm" c="dimmed">
          {version === null
            ? t('template.unsaved')
            : t('template.versionLabel', { version })}
        </Text>
        <Group gap="sm">
          <FileButton onChange={uploadPdf} accept={PdfType}>
            {(props) => (
              <Button
                {...props}
                variant="default"
                loading={busy === 'pdf'}
                disabled={busy !== null && busy !== 'pdf'}
                leftSection={<IconFileTypePdf size={16} stroke={1.5} />}
              >
                {t('template.replacePdf')}
              </Button>
            )}
          </FileButton>
          <Button
            variant="default"
            loading={busy === 'font'}
            disabled={busy !== null && busy !== 'font'}
            leftSection={<IconTypography size={16} stroke={1.5} />}
            onClick={() => setFontsOpen(true)}
          >
            {t('template.fonts')}
          </Button>
          <FontsModal
            opened={fontsOpen}
            onClose={() => setFontsOpen(false)}
            loaded={[...fonts.keys()].flatMap(
              (sha256) => fontInfo.get(sha256) ?? [],
            )}
            busy={busy === 'font'}
            onAdd={addStoredFont}
            onRemove={unloadFont}
            onUpload={uploadFont}
            onImported={loadFont}
          />
          <Button
            onClick={() => void save()}
            loading={busy === 'save'}
            disabled={!changed || (busy !== null && busy !== 'save')}
            leftSection={<IconDeviceFloppy size={16} stroke={1.5} />}
          >
            {t('template.save')}
          </Button>
        </Group>
      </Group>
      {!hasFonts && (
        <Alert variant="light" icon={<IconInfoCircle size={18} stroke={1.5} />}>
          {t('template.needsFont')}
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert
          color="yellow"
          variant="light"
          title={t('template.missingGlyphsTitle')}
          icon={<IconAlertTriangle size={18} stroke={1.5} />}
        >
          <Stack gap={4}>
            <Text size="sm">{t('template.missingGlyphsText')}</Text>
            <List size="sm">
              {warnings.map((warning) => (
                <List.Item key={warning.field}>
                  {t('template.missingGlyphsItem', {
                    field: warning.field,
                    characters: warning.missing.join(' '),
                    font: fontLabelOf(fontInfo, warning.font),
                  })}
                </List.Item>
              ))}
            </List>
          </Stack>
        </Alert>
      )}
      <TemplateDesigner
        ref={designer}
        template={template}
        fonts={fontOption}
        plugins={plugins}
        fieldNames={fieldNames}
        onLoad={onLoad}
        onChange={onChange}
      />
    </Stack>
  );
}

function fontLabelOf(
  fontInfo: ReadonlyMap<string, FontSummary>,
  sha256: string,
): string {
  const font = fontInfo.get(sha256);
  return font ? `${font.family} ${font.style}` : sha256.slice(0, 8);
}

// the local date, as dates are written on certificates
function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// the fields as text, equal for equal fields
function fieldsKeyOf(schemas: Template['schemas']): string {
  return JSON.stringify(schemas, canonical);
}

// pdfme adds defaults such as readOnly false once a field is edited, so false counts as unset; keys sorted
function canonical(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== false && entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

// the fields only: the base PDF goes by its hash, not its bytes
function withoutBasePdf(
  designer: TemplateDesignerHandle,
): TemplateEditorContent {
  return { schemas: designer.getTemplate().schemas };
}

// one decimal, such as 2.4 MB
function formatMegabytes(bytes: number, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024));
}
