import {
  CourseDateFormatter,
  type FontSummary,
  type Locale,
  TemplateFieldTypeEnum,
} from '@cert-it/shared';
import type { Font, Template } from '@pdfme/common';
import { Center, Image, Loader, Modal, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '../../app/api/ApiClient';
import { MonoFigure } from '../../app/layout/MonoFigure';
import { certificatePageUrl } from '../../course/participants/certificatePageUrl';
import { createFieldPlugins } from '../../course/template/designer/createFieldPlugins';
import {
  generatePreview,
  sampleInputs,
} from '../../course/template/preview/generatePreview';
import { createSamplePdf } from '../practice/createSamplePdf';
import { TourTargetEnum } from '../tour/TourTargetEnum';

type SampleCertificateModalProps = {
  opened: boolean;
  onClose: () => void;
  /** The real API client, to read a stored font from. */
  api: ApiClient;
};

const SampleCode = 'ABCD-EFGH-JK';

/** A certificate made in the browser from sample data, with what its code is for. */
export function SampleCertificateModal({
  opened,
  onClose,
  api,
}: SampleCertificateModalProps) {
  const { t, i18n } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    let current = true;
    let url: string | null = null;

    void (async () => {
      const font = await firstFont(api);
      const locale = i18n.language as Locale;
      const values = {
        participantName: t('onboarding.samples.participant1'),
        issueDate: new CourseDateFormatter({
          locale,
          dateFormat: CourseDateFormatter.DefaultFormats[locale],
        }).format(dayjs().format('YYYY-MM-DD')),
        qrcode: certificatePageUrl(SampleCode),
      };
      const template: Template = {
        basePdf: createSamplePdf({
          title: t('onboarding.samples.pdfTitle'),
          intro: t('onboarding.samples.pdfIntro'),
          outro: t('onboarding.samples.pdfOutro'),
        }),
        schemas: [sampleFields(font?.summary ?? null, values)],
      };
      const fonts: Font = font
        ? { [font.summary.sha256]: { data: font.bytes, fallback: true } }
        : {};
      const plugins = createFieldPlugins({
        labels: {
          participantName: TemplateFieldTypeEnum.ParticipantName,
          issueDate: TemplateFieldTypeEnum.IssueDate,
          qrcode: TemplateFieldTypeEnum.QrCode,
        },
        samples: values,
        withText: font !== null,
        fontLabel: (sha256) => sha256,
      });
      const { image } = await generatePreview({
        template,
        inputs: sampleInputs(template.schemas),
        fonts,
        plugins,
      });
      url = URL.createObjectURL(image);
      if (current) setImageUrl(url);
    })().catch(() => {
      // the text still explains it without the picture
      if (current) setImageUrl('');
    });

    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
      setImageUrl(null);
    };
  }, [opened, api, t, i18n.language]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('onboarding.certificate.title')}
      size="xl"
    >
      <Stack gap="md">
        <div data-tour={TourTargetEnum.SampleCertificate}>
          {imageUrl === null ? (
            <Center mih={320}>
              <Loader size="sm" />
            </Center>
          ) : (
            imageUrl && <Image src={imageUrl} radius="md" alt="" />
          )}
        </div>
        <Text size="sm">
          {t('onboarding.certificate.code')}:{' '}
          <MonoFigure>{SampleCode}</MonoFigure>
        </Text>
        <Text size="sm" c="dimmed">
          {t('onboarding.certificate.codeText')}
        </Text>
        <Text size="sm" c="dimmed">
          {t('onboarding.certificate.lookupText')}
        </Text>
      </Stack>
    </Modal>
  );
}

// the first stored font, with its bytes, or null without one
async function firstFont(
  api: ApiClient,
): Promise<{ summary: FontSummary; bytes: ArrayBuffer } | null> {
  const [summary] = await api.request((routes) => routes.fonts.$get());
  if (!summary) return null;
  const bytes = await api.requestBytes((routes) =>
    routes.fonts[':sha256'].$get({ param: { sha256: summary.sha256 } }),
  );
  return { summary, bytes };
}

// the name and date need a font; the QR code doesn't
function sampleFields(
  font: FontSummary | null,
  values: { participantName: string; issueDate: string; qrcode: string },
): Template['schemas'][number] {
  const qrcode = {
    name: 'qrcode',
    type: TemplateFieldTypeEnum.QrCode,
    position: { x: 252, y: 162 },
    width: 25,
    height: 25,
    content: values.qrcode,
    backgroundColor: '#ffffff',
    barColor: '#000000',
  };
  if (!font) return [qrcode];

  const text = {
    fontName: font.sha256,
    alignment: 'center',
    verticalAlignment: 'middle',
    lineHeight: 1,
    characterSpacing: 0,
  };
  return [
    {
      ...text,
      name: 'participantName',
      type: TemplateFieldTypeEnum.ParticipantName,
      position: { x: 58.5, y: 92 },
      width: 180,
      height: 20,
      fontSize: 32,
      fontColor: '#18181b',
      content: values.participantName,
    },
    {
      ...text,
      name: 'issueDate',
      type: TemplateFieldTypeEnum.IssueDate,
      position: { x: 108.5, y: 140 },
      width: 80,
      height: 10,
      fontSize: 14,
      fontColor: '#52525b',
      content: values.issueDate,
    },
    qrcode,
  ];
}
