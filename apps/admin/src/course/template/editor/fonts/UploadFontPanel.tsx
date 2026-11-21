import '@mantine/dropzone/styles.css';
import { Stack, Text, ThemeIcon } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconTypography } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

type UploadFontPanelProps = {
  busy: boolean;
  onUpload: (file: File) => void;
};

// browsers report font files under several types, so the extension decides too
const FontFiles = {
  'font/ttf': ['.ttf'],
  'font/otf': ['.otf'],
  'font/sfnt': ['.ttf', '.otf'],
  'application/x-font-ttf': ['.ttf'],
  'application/x-font-otf': ['.otf'],
  'application/octet-stream': ['.ttf', '.otf'],
};

/** A drop zone for a TTF or OTF file; clicking it opens the file picker too. */
export function UploadFontPanel({ busy, onUpload }: UploadFontPanelProps) {
  const { t } = useTranslation();

  return (
    <Dropzone
      onDrop={([file]) => file && onUpload(file)}
      onReject={() =>
        notifications.show({
          color: 'red',
          message: t('apiErrors.codes.invalidFont'),
        })
      }
      accept={FontFiles}
      maxFiles={1}
      multiple={false}
      loading={busy}
    >
      <Stack align="center" gap="md" py="xl" mih={220} justify="center">
        <ThemeIcon variant="light" size={48} radius="xl">
          <IconTypography size={26} stroke={1.5} />
        </ThemeIcon>
        <Stack gap={4} align="center" maw={380}>
          <Text fw={500}>{t('template.fontsModal.uploadTitle')}</Text>
          <Text c="dimmed" size="sm" ta="center">
            {t('template.fontsModal.uploadText')}
          </Text>
        </Stack>
      </Stack>
    </Dropzone>
  );
}
