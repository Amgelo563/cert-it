import type { SaveTemplateRequest } from '@cert-it/shared';
import type { Font, Template } from '@pdfme/common';
import '@mantine/dropzone/styles.css';
import {
  Button,
  FileButton,
  Group,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconFileTypePdf,
  IconTypography,
} from '@tabler/icons-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';
import { LeaveGuard } from '../../../app/router/LeaveGuard';
import {
  TemplateDesigner,
  type TemplateDesignerHandle,
} from '../designer/TemplateDesigner';

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
};

type TemplateEditorProps = {
  courseId: number;
  start: TemplateEditorStart;
  /** Called after saving a version, such as to refresh the course's counts. */
  onSaved: () => void;
};

type Busy = 'pdf' | 'font' | 'save' | null;

const PdfType = 'application/pdf';

const FontTypes = '.ttf,.otf,font/ttf,font/otf';

/** The Designer with its toolbar: upload a base PDF or a font, and save the canvas as a new version. */
export function TemplateEditor({
  courseId,
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
  const [busy, setBusy] = useState<Busy>(null);
  // the canvas's fields and the last saved version, as comparable keys
  const [fieldsKey, setFieldsKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const param = { courseId: String(courseId) };

  // a new base PDF counts as a change, even with the same fields
  const currentKey =
    basePdf && fieldsKey !== null ? `${basePdf.sha256}:${fieldsKey}` : null;
  const changed = currentKey !== null && currentKey !== savedKey;

  // the loaded version is the baseline, as pdfme read it, so its own tidying isn't a change
  const onLoad = (loaded: Template) => {
    const key = fieldsKeyOf(loaded);
    setFieldsKey(key);
    if (version !== null && basePdf) setSavedKey(`${basePdf.sha256}:${key}`);
  };
  const onChange = (edited: Template) => setFieldsKey(fieldsKeyOf(edited));

  // the first font is the fallback pdfme asks for; every field names its own
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

  // a new value only when the base PDF changes, so typing on the canvas never resets it
  const template = useMemo<Template | null>(
    () => (basePdf ? { ...content, basePdf: basePdf.bytes } : null),
    [content, basePdf],
  );

  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } catch (error) {
      notifications.show({
        color: 'red',
        message: describeApiError(error, i18n),
      });
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

  const addFont = (file: File | null) =>
    file
    && run('font', async () => {
      const font = await api.request((routes) =>
        routes.fonts.$post(
          {},
          {
            headers: { 'Content-Type': 'application/octet-stream' },
            init: { body: file },
          },
        ),
      );
      const bytes = await file.arrayBuffer();
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
    });

  const save = () =>
    basePdf
    && run('save', async () => {
      const content = withoutBasePdf(designer.current!);
      const saved = await api.request((routes) =>
        routes.courses[':courseId'].template.$post({
          param,
          json: {
            basePdf: basePdf.sha256,
            // the server checks every field against its own schema
            template: content as SaveTemplateRequest['template'],
          },
        }),
      );
      // what was sent is now the baseline, even if the canvas changed meanwhile
      setSavedKey(`${basePdf.sha256}:${fieldsKeyOf(content)}`);
      setVersion(saved.version);
      notifications.show({
        color: 'teal',
        message: t('template.saved', { version: saved.version }),
      });
      onSaved();
    });

  const pdfButton = (
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
  );

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
          {pdfButton}
          <FileButton onChange={addFont} accept={FontTypes}>
            {(props) => (
              <Button
                {...props}
                variant="default"
                loading={busy === 'font'}
                disabled={busy !== null && busy !== 'font'}
                leftSection={<IconTypography size={16} stroke={1.5} />}
              >
                {t('template.addFont')}
              </Button>
            )}
          </FileButton>
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
      <TemplateDesigner
        ref={designer}
        template={template}
        fonts={fontOption}
        onLoad={onLoad}
        onChange={onChange}
      />
    </Stack>
  );
}

// the fields as text, equal for equal fields
function fieldsKeyOf(template: Pick<Template, 'schemas'>): string {
  return JSON.stringify(template.schemas, canonical);
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
