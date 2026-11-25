import {
  type CourseFieldSummary,
  type CourseFieldType,
  CourseFieldTypeEnum,
  type CourseSummary,
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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';
import { type BuiltImport, buildImportRows } from './buildImportRows';
import { type ColumnRole, ColumnRoleEnum, fieldRole } from './ColumnRoleEnum';
import type { CsvTable } from './CsvTable';
import { guessColumnRoles, guessFieldType } from './guessColumnRoles';
import { columnsProblem, newFieldLabel } from './columnsProblem';
import type { ImageIndex } from './ImageIndex';
import { ColumnsStep } from './steps/ColumnsStep';
import { FileStep } from './steps/FileStep';
import classes from './ImportParticipantsModal.module.css';
import { PreviewStep } from './steps/PreviewStep';

const StepEnum = { File: 0, Columns: 1, Preview: 2 } as const;

// uploads at once, so many images don't flood the server
const UploadConcurrency = 4;

type ImportParticipantsModalProps = {
  opened: boolean;
  course: Pick<CourseSummary, 'id' | 'locale'>;
  /** The course's fields, which columns can be mapped to. */
  fields: readonly CourseFieldSummary[];
  /** Called after columns were added as new fields, to load the fields again. */
  onFieldsAdded: () => void;
  onClose: () => void;
  /** Called after an import that saved something, to reload the list. */
  onImported: () => void;
};

type FileState = { name: string; table: CsvTable };

type Progress = { done: number; total: number };

/** Imports participants from a CSV: pick the file, map its columns to the course's fields, check the server's preview, then upload any images and import. */
export function ImportParticipantsModal({
  opened,
  course,
  fields,
  onFieldsAdded,
  onClose,
  onImported,
}: ImportParticipantsModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [step, setStep] = useState<number>(StepEnum.File);
  const [file, setFile] = useState<FileState | null>(null);
  const [roles, setRoles] = useState<ColumnRole[]>([]);
  const [newTypes, setNewTypes] = useState<Record<number, CourseFieldType>>({});
  const [images, setImages] = useState<ImageIndex>(new Map());
  const [mode, setMode] = useState<ImportMode>(ImportModeEnum.Skip);
  const [built, setBuilt] = useState<BuiltImport | null>(null);
  // fields added by this import, until the course's fields load again
  const [added, setAdded] = useState<CourseFieldSummary[]>([]);
  const [preview, setPreview] = useState<ImportParticipantsResponse | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const param = { courseId: String(course.id) };

  const known = [
    ...fields,
    ...added.filter((field) => !fields.some(({ id }) => id === field.id)),
  ];
  const saving = preview
    ? preview.totals[ImportRowStatusEnum.Create]
      + preview.totals[ImportRowStatusEnum.Update]
    : 0;

  // cleared once the modal is gone, so nothing changes while it fades out
  const reset = () => {
    setStep(StepEnum.File);
    setFile(null);
    setImages(new Map());
    setBuilt(null);
    setAdded([]);
    setPreview(null);
    setError(null);
    setProgress(null);
  };

  const send = (rows: BuiltImport['rows'], dryRun: boolean) =>
    api.request((routes) =>
      routes.courses[':courseId'].participants.import.$post({
        param,
        json: { mode, dryRun, rows },
      }),
    );

  // each column for a new field becomes that field, so going back maps to it
  const addNewFields = async (table: CsvTable): Promise<ColumnRole[]> => {
    const mapped = [...roles];
    const created: CourseFieldSummary[] = [];
    try {
      for (const [index, role] of roles.entries()) {
        if (role !== ColumnRoleEnum.New) continue;
        const field = await api.request((routes) =>
          routes.courses[':courseId'].fields.$post({
            param,
            json: {
              label: newFieldLabel(table.headers[index] ?? ''),
              type: newTypes[index] ?? CourseFieldTypeEnum.Text,
              required: false,
            },
          }),
        );
        created.push(field);
        mapped[index] = fieldRole(field.id);
      }
    } finally {
      if (created.length > 0) {
        setAdded((current) => [...current, ...created]);
        setRoles(mapped);
        onFieldsAdded();
      }
    }
    return mapped;
  };

  const check = async () => {
    if (!file) return;
    setSending(true);
    setError(null);
    try {
      const mapped = await addNewFields(file.table);
      // the server's list, with the new fields and any change by others
      const fresh = await api.request((routes) =>
        routes.courses[':courseId'].fields.$get({ param }),
      );
      const rows = await buildImportRows(file.table, mapped, fresh, images);
      setBuilt(rows);
      setPreview(await send(rows.rows, true));
      setStep(StepEnum.Preview);
    } catch (caught) {
      setError(caught);
    } finally {
      setSending(false);
    }
  };

  // each image once, a few at a time
  const uploadImages = async (uploads: BuiltImport['uploads']) => {
    const queue = [...uploads.values()];
    const total = queue.length;
    let done = 0;
    if (total === 0) return;
    setProgress({ done, total });

    const worker = async () => {
      for (let image = queue.shift(); image; image = queue.shift()) {
        const body = image;
        await api.request((routes) =>
          routes.courses[':courseId'].images.$post(
            { param },
            { headers: { 'Content-Type': body.type }, init: { body } },
          ),
        );
        done += 1;
        setProgress({ done, total });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(UploadConcurrency, total) }, worker),
    );
  };

  const runImport = async () => {
    if (!built) return;
    setSending(true);
    setError(null);
    try {
      await uploadImages(built.uploads);
      setProgress(null);
      const { totals } = await send(built.rows, false);
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
      setProgress(null);
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
              const guessed = guessColumnRoles(table.headers, fields);
              setFile({ name, table });
              setRoles(guessed);
              setNewTypes(
                Object.fromEntries(
                  guessed.flatMap((role, index) =>
                    role === ColumnRoleEnum.New
                      ? [[index, guessFieldType(table, index, course.locale)]]
                      : [],
                  ),
                ),
              );
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
              newTypes={newTypes}
              fields={known}
              mode={mode}
              images={images}
              onRolesChange={setRoles}
              onNewTypesChange={setNewTypes}
              onModeChange={setMode}
              onImagesChange={setImages}
            />
          </>
        )}
        {step === StepEnum.Preview && file && preview && built && (
          <PreviewStep
            table={file.table}
            rows={built.rows}
            preview={preview}
            fields={known}
          />
        )}

        <Group justify="space-between">
          {step === StepEnum.File ? (
            <span />
          ) : (
            <Button
              variant="subtle"
              color="gray"
              disabled={sending}
              onClick={() => {
                setError(null);
                setStep(step - 1);
              }}
            >
              {t('participantImport.back')}
            </Button>
          )}
          <Group gap="sm">
            {progress && (
              <Text size="sm" c="dimmed">
                {t('fieldImport.uploading', progress)}
              </Text>
            )}
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            {step === StepEnum.Columns && file && (
              <Button
                loading={sending}
                disabled={
                  columnsProblem(roles, file.table.headers, known) !== null
                }
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
