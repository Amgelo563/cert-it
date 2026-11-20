import '@mantine/dropzone/styles.css';
import { MaxImportRows } from '@cert-it/shared';
import { Alert, Anchor, Group, Stack, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconAlertCircle, IconFileSpreadsheet } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CsvTable } from '../CsvTable';
import { downloadSampleCsv } from '../downloadSampleCsv';
import { readCsv } from '../readCsv';

const MaxFileBytes = 5 * 1024 * 1024;

type FileStepProps = {
  /** Called with the file's name and contents once it reads without problems. */
  onRead: (fileName: string, table: CsvTable) => void;
};

/** Drop zone for the CSV, with a sample file to start from. */
export function FileStep({ onRead }: FileStepProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const read = async (file: File) => {
    setReading(true);
    setError(null);
    try {
      const table = readCsv(await file.arrayBuffer());
      if (table.headers.length === 0 || table.rows.length === 0) {
        setError(t('participantImport.emptyFile'));
      } else if (table.rows.length > MaxImportRows) {
        setError(
          t('participantImport.tooManyRows', {
            count: table.rows.length,
            max: MaxImportRows,
          }),
        );
      } else {
        onRead(file.name, table);
      }
    } catch {
      setError(t('participantImport.unreadableFile'));
    } finally {
      setReading(false);
    }
  };

  return (
    <Stack gap="md">
      {error !== null && (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertCircle size={18} stroke={1.5} />}
        >
          {error}
        </Alert>
      )}
      <Dropzone
        onDrop={([file]) => file && void read(file)}
        onReject={() => setError(t('participantImport.rejectedFile'))}
        maxSize={MaxFileBytes}
        maxFiles={1}
        multiple={false}
        loading={reading}
        // browsers report CSV files under several types, Excel's included
        accept={{
          'text/csv': ['.csv'],
          'text/plain': ['.csv', '.txt'],
          'application/vnd.ms-excel': ['.csv'],
        }}
      >
        <Group justify="center" gap="md" mih={160} wrap="nowrap">
          <IconFileSpreadsheet
            size={40}
            stroke={1.5}
            color="var(--mantine-color-dimmed)"
          />
          <Stack gap={4}>
            <Text fw={500}>{t('participantImport.dropTitle')}</Text>
            <Text size="sm" c="dimmed">
              {t('participantImport.dropDescription', { max: MaxImportRows })}
            </Text>
          </Stack>
        </Group>
      </Dropzone>
      <Text size="sm" c="dimmed">
        {t('participantImport.sampleText')}{' '}
        <Anchor
          component="button"
          type="button"
          size="sm"
          onClick={() => downloadSampleCsv(i18n.language)}
        >
          {t('participantImport.sampleLink')}
        </Anchor>
      </Text>
    </Stack>
  );
}
