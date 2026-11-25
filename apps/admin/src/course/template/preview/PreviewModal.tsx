import type { GlyphChecker } from '@cert-it/fonts';
import {
  buildTemplateInputs,
  type CourseFieldSummary,
  CourseFieldTypeEnum,
  type CourseSummary,
  CourseDateFormatter,
  type ParticipantSummary,
  TemplateFieldTypeEnum,
  type TemplateValues,
} from '@cert-it/shared';
import type { Font, Plugins, Template } from '@pdfme/common';
import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Image,
  List,
  Loader,
  LoadingOverlay,
  Modal,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconDownload,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { certificatePageUrl } from '../../participants/certificatePageUrl';
import { findGlyphWarnings } from '../editor/templateFields';
import { generatePreview, sampleInputs } from './generatePreview';
import { fieldImageUrl } from '../../fields/fieldImageUrl';
import { ParticipantPicker } from './ParticipantPicker';
import { loadFieldImages, previewFieldValues } from './previewFieldValues';

type PreviewSource = 'sample' | 'participant';

/** What the preview is drawn from: the template as it was when the preview opened. */
type PreviewModalProps = {
  course: CourseSummary;
  /** The template with its base PDF, or null while closed. */
  template: Template | null;
  onClose: () => void;
  fonts: Font;
  plugins: Plugins;
  /** Values of a participant without a certificate yet, for the date and QR code. */
  samples: TemplateValues;
  /** The course's fields, whose values a participant's preview prints. */
  fields: readonly CourseFieldSummary[];
  /** What a field without a value prints instead. */
  fieldSample: (field: CourseFieldSummary) => string;
  /** Glyph checkers by font SHA-256. */
  checkers: ReadonlyMap<string, GlyphChecker>;
  fontLabel: (sha256: string) => string;
};

/** Generates a certificate in the browser from the canvas, with its samples or a real participant. */
export function PreviewModal({
  template,
  onClose,
  ...props
}: PreviewModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={template !== null}
      onClose={onClose}
      title={t('template.preview.title')}
      size="xl"
    >
      {template && <PreviewBody template={template} {...props} />}
    </Modal>
  );
}

type PreviewBodyProps = Omit<PreviewModalProps, 'template' | 'onClose'> & {
  template: Template;
};

/** The last finished preview, with the inputs it was generated from. */
type Settled = {
  inputs: Record<string, string>[];
} & (
  | { status: 'ready'; pdfUrl: string; imageUrl: string }
  | { status: 'failed'; error: unknown }
);

function PreviewBody({
  course,
  template,
  fonts,
  plugins,
  samples,
  fields,
  fieldSample,
  checkers,
  fontLabel,
}: PreviewBodyProps) {
  const { t, i18n } = useTranslation();
  const [source, setSource] = useState<PreviewSource>('sample');
  const [participant, setParticipant] = useState<ParticipantSummary | null>(
    null,
  );
  const [settled, setSettled] = useState<Settled | null>(null);

  // the picked participant's images, loaded before their preview is drawn
  const [images, setImages] = useState<{
    participantId: number;
    urls: ReadonlyMap<string, string>;
  } | null>(null);
  useEffect(() => {
    if (!participant) return;
    let current = true;
    const urls = new Map(
      fields.flatMap((field) => {
        const value = participant.fieldValues[String(field.id)];
        return field.type === CourseFieldTypeEnum.Image
          && typeof value === 'string'
          ? [[value, fieldImageUrl(course.id, value)] as const]
          : [];
      }),
    );
    void loadFieldImages(urls).then((loaded) => {
      if (current) setImages({ participantId: participant.id, urls: loaded });
    });
    return () => {
      current = false;
    };
  }, [participant, fields, course.id]);
  const imagesReady =
    participant !== null && images?.participantId === participant.id;

  const values = useMemo(
    () => (participant ? valuesOf(participant, course, samples) : null),
    [participant, course, samples],
  );
  // null while a participant is still to be picked, or their images load
  const inputs = useMemo(() => {
    if (source === 'sample') return sampleInputs(template.schemas);
    if (!values || !participant || !imagesReady) return null;
    return buildTemplateInputs(
      template.schemas,
      values,
      previewFieldValues(fields, participant.fieldValues, {
        locale: course.locale,
        dateFormat: course.dateFormat,
        images: images.urls,
        sample: fieldSample,
      }),
    );
  }, [
    source,
    values,
    template,
    participant,
    imagesReady,
    images,
    fields,
    course,
    fieldSample,
  ]);

  const warnings = useMemo(
    () =>
      source === 'participant' && inputs?.[0]
        ? findGlyphWarnings(template.schemas, checkers, inputs[0])
        : [],
    [source, inputs, template, checkers],
  );

  useEffect(() => {
    if (!inputs) return;
    let current = true;

    generatePreview({ template, inputs, fonts, plugins }).then(
      ({ pdf, image }) => {
        if (!current) return;
        setSettled({
          inputs,
          status: 'ready',
          pdfUrl: URL.createObjectURL(pdf),
          imageUrl: URL.createObjectURL(image),
        });
      },
      (error: unknown) => {
        if (current) setSettled({ inputs, status: 'failed', error });
      },
    );

    return () => {
      current = false;
    };
  }, [inputs, template, fonts, plugins]);

  // a preview's URLs live until another replaces it, as its page stays shown meanwhile
  useEffect(() => {
    if (settled?.status !== 'ready') return;
    return () => {
      URL.revokeObjectURL(settled.pdfUrl);
      URL.revokeObjectURL(settled.imageUrl);
    };
  }, [settled]);

  const fresh = inputs !== null && settled?.inputs === inputs;
  const loading = inputs !== null && !fresh;
  // the previous page stays under the loader until the new one is drawn
  const shown = settled?.status === 'ready' ? settled : null;
  const ready = fresh ? shown : null;
  const failed = fresh && settled.status === 'failed' ? settled : null;
  const fileName = `${participant && source === 'participant' ? participant.name : t('template.preview.sampleFile')}.pdf`;

  return (
    <Stack gap="md">
      <SegmentedControl
        value={source}
        onChange={(value) => setSource(value as PreviewSource)}
        data={[
          { value: 'sample', label: t('template.preview.sample') },
          { value: 'participant', label: t('template.preview.participant') },
        ]}
      />
      {source === 'participant' && (
        <ParticipantPicker
          courseId={course.id}
          value={participant}
          onChange={setParticipant}
        />
      )}
      {source === 'participant' && participant && !participant.certificate && (
        <Alert variant="light" icon={<IconInfoCircle size={18} stroke={1.5} />}>
          {t('template.preview.notIssued')}
        </Alert>
      )}
      {warnings.length > 0 && participant && (
        <Alert
          color="yellow"
          variant="light"
          title={t('template.preview.missingGlyphsTitle', {
            name: participant.name,
          })}
          icon={<IconAlertTriangle size={18} stroke={1.5} />}
        >
          <Stack gap={4}>
            <Text size="sm">{t('template.preview.missingGlyphsText')}</Text>
            <List size="sm">
              {warnings.map((warning) => (
                <List.Item key={warning.field}>
                  {t('template.missingGlyphsItem', {
                    field: warning.field,
                    characters: warning.missing.join(' '),
                    font: fontLabel(warning.font),
                  })}
                </List.Item>
              ))}
            </List>
          </Stack>
        </Alert>
      )}
      {failed ? (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertCircle size={18} stroke={1.5} />}
        >
          {t('template.preview.failed', {
            reason: describeApiError(failed.error, i18n),
          })}
        </Alert>
      ) : !inputs ? (
        <Center mih={200}>
          <Text c="dimmed" size="sm">
            {t('template.preview.pickHint')}
          </Text>
        </Center>
      ) : (
        <Box pos="relative" mih={200}>
          <LoadingOverlay
            visible={loading}
            loaderProps={{ children: <Loader aria-label={t('app.loading')} /> }}
          />
          {shown && (
            <Image
              src={shown.imageUrl}
              alt={t('template.preview.imageAlt')}
              radius="sm"
              bd="1px solid var(--mantine-color-default-border)"
            />
          )}
        </Box>
      )}
      <Group justify="flex-end">
        <Button
          component="a"
          href={ready?.pdfUrl}
          download={fileName}
          disabled={!ready}
          leftSection={<IconDownload size={16} stroke={1.5} />}
        >
          {t('template.preview.download')}
        </Button>
      </Group>
    </Stack>
  );
}

// what issuing would print: their certificate's date and code, or today's and a sample until it's issued
function valuesOf(
  participant: ParticipantSummary,
  course: CourseSummary,
  samples: TemplateValues,
): TemplateValues {
  const { certificate } = participant;
  const formatter = new CourseDateFormatter({
    locale: course.locale,
    dateFormat: course.dateFormat,
  });

  return {
    [TemplateFieldTypeEnum.ParticipantName]: participant.name,
    [TemplateFieldTypeEnum.IssueDate]: certificate
      ? formatter.format(certificate.issueDate)
      : samples.issueDate,
    [TemplateFieldTypeEnum.QrCode]: certificate
      ? certificatePageUrl(certificate.code)
      : samples.qrcode,
  };
}
