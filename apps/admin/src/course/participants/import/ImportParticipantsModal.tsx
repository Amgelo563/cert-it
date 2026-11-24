import {
  type ImportMode,
  ImportModeEnum,
  type ImportParticipantsResponse,
  ImportRowStatusEnum,
} from '@cert-it/shared';
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Stepper,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';
import { buildImportRows } from './buildImportRows';
import type { ColumnRole } from './ColumnRoleEnum';
import type { CsvTable } from './CsvTable';
import { guessColumnRoles } from './guessColumnRoles';
import { columnsProblem } from './columnsProblem';
import { ColumnsStep } from './steps/ColumnsStep';
import { FileStep } from './steps/FileStep';
import classes from './ImportParticipantsModal.module.css';
import { PreviewStep } from './steps/PreviewStep';

const StepEnum = { File: 0, Columns: 1, Preview: 2 } as const;

type ImportParticipantsModalProps = {
  opened: boolean;
  courseId: number;
  onClose: () => void;
  /** Called after an import that saved something, to reload the list. */
  onImported: () => void;
};

type FileState = { name: string; table: CsvTable };

/** Imports participants from a CSV: pick the file, map its columns, check the server's preview, then import. */
export function ImportParticipantsModal({
  opened,
  courseId,
  onClose,
  onImported,
}: ImportParticipantsModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [step, setStep] = useState<number>(StepEnum.File);
  const [file, setFile] = useState<FileState | null>(null);
  const [roles, setRoles] = useState<ColumnRole[]>([]);
  const [mode, setMode] = useState<ImportMode>(ImportModeEnum.Skip);
  const [preview, setPreview] = useState<ImportParticipantsResponse | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  const rows = useMemo(
    () => (file ? buildImportRows(file.table, roles) : []),
    [file, roles],
  );
  const saving = preview
    ? preview.totals[ImportRowStatusEnum.Create]
      + preview.totals[ImportRowStatusEnum.Update]
    : 0;

  // cleared once the modal is gone, so nothing changes while it fades out
  const reset = () => {
    setStep(StepEnum.File);
    setFile(null);
    setPreview(null);
    setError(null);
  };

  // the same request both times; only dryRun changes
  const send = (dryRun: boolean) =>
    api.request((routes) =>
      routes.courses[':courseId'].participants.import.$post({
        param: { courseId: String(courseId) },
        json: { mode, dryRun, rows },
      }),
    );

  const check = async () => {
    setSending(true);
    setError(null);
    try {
      setPreview(await send(true));
      setStep(StepEnum.Preview);
    } catch (caught) {
      setError(caught);
    } finally {
      setSending(false);
    }
  };

  const runImport = async () => {
    setSending(true);
    setError(null);
    try {
      const { totals } = await send(false);
      notifications.show({
        color: 'teal',
        message: t('participantImport.done', {
          created: totals.create,
          updated: totals.update,
          skipped: totals.skip,
          invalid: totals.invalid,
        }),
      });
      onImported();
      onClose();
    } catch (caught) {
      setError(caught);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={reset}
      title={t('participantImport.title')}
      size="xl"
    >
      <Stack gap="lg">
        <Stepper
          active={step}
          size="sm"
          allowNextStepsSelect={false}
          classNames={{ stepIcon: classes.stepIcon }}
        >
          <Stepper.Step label={t('participantImport.stepFile')} />
          <Stepper.Step label={t('participantImport.stepColumns')} />
          <Stepper.Step label={t('participantImport.stepPreview')} />
        </Stepper>

        {error !== null && (
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertCircle size={18} stroke={1.5} />}
          >
            {describeApiError(error, i18n)}
          </Alert>
        )}

        {step === StepEnum.File && (
          <FileStep
            onRead={(name, table) => {
              setFile({ name, table });
              setRoles(guessColumnRoles(table.headers));
              setStep(StepEnum.Columns);
            }}
          />
        )}
        {step === StepEnum.Columns && file && (
          <>
            <Text size="sm" c="dimmed">
              {t('participantImport.fileSummary', {
                file: file.name,
                count: file.table.rows.length,
              })}
            </Text>
            <ColumnsStep
              table={file.table}
              roles={roles}
              mode={mode}
              onRolesChange={setRoles}
              onModeChange={setMode}
            />
          </>
        )}
        {step === StepEnum.Preview && file && preview && (
          <PreviewStep table={file.table} rows={rows} preview={preview} />
        )}

        <Group justify="space-between">
          {step === StepEnum.File ? (
            <span />
          ) : (
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setError(null);
                setStep(step - 1);
              }}
            >
              {t('participantImport.back')}
            </Button>
          )}
          <Group gap="sm">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            {step === StepEnum.Columns && (
              <Button
                loading={sending}
                disabled={columnsProblem(roles) !== null}
                onClick={() => void check()}
              >
                {t('participantImport.check')}
              </Button>
            )}
            {step === StepEnum.Preview && (
              <Button
                loading={sending}
                disabled={saving === 0}
                onClick={() => void runImport()}
              >
                {t('participantImport.import', { count: saving })}
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
