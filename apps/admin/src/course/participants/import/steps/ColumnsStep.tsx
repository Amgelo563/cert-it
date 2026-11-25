import '@mantine/dropzone/styles.css';
import {
  type CourseFieldSummary,
  type CourseFieldType,
  CourseFieldTypeEnum,
  type ImportMode,
  ImportModeEnum,
  MaxCourseFields,
} from '@cert-it/shared';
import { Alert, Group, Radio, Select, Stack, Table, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { IconAlertCircle, IconPhoto } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { columnsProblem } from '../columnsProblem';
import {
  type ColumnRole,
  ColumnRoleEnum,
  fieldIdOf,
  fieldRole,
  isColumnRole,
} from '../ColumnRoleEnum';
import type { CsvTable } from '../CsvTable';
import { countImages, type ImageIndex, indexImages } from '../ImageIndex';

type ColumnsStepProps = {
  table: CsvTable;
  roles: readonly ColumnRole[];
  /** Type of each column's new field, by column index. */
  newTypes: Readonly<Record<number, CourseFieldType>>;
  fields: readonly CourseFieldSummary[];
  mode: ImportMode;
  images: ImageIndex;
  onRolesChange: (roles: ColumnRole[]) => void;
  onNewTypesChange: (types: Record<number, CourseFieldType>) => void;
  onModeChange: (mode: ImportMode) => void;
  onImagesChange: (images: ImageIndex) => void;
};

/** Which column holds what, with a value from the first row, the images of image fields, and what to do with emails already in the course. */
export function ColumnsStep({
  table,
  roles,
  newTypes,
  fields,
  mode,
  images,
  onRolesChange,
  onNewTypesChange,
  onModeChange,
  onImagesChange,
}: ColumnsStepProps) {
  const { t } = useTranslation();
  const [imageError, setImageError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const problem = columnsProblem(roles, table.headers, fields);

  const options = useMemo(
    () => [
      { value: ColumnRoleEnum.Name, label: t('participantImport.roles.name') },
      {
        value: ColumnRoleEnum.Email,
        label: t('participantImport.roles.email'),
      },
      ...fields.map((field) => ({
        value: fieldRole(field.id),
        label: `${field.label} (${t(`courseFields.types.${field.type}`)})`,
      })),
      { value: ColumnRoleEnum.New, label: t('fieldImport.newField') },
      {
        value: ColumnRoleEnum.Ignore,
        label: t('participantImport.roles.ignore'),
      },
    ],
    [t, fields],
  );
  const types = useMemo(
    () =>
      Object.values(CourseFieldTypeEnum).map((value) => ({
        value,
        label: t(`courseFields.types.${value}`),
      })),
    [t],
  );

  const byId = new Map(fields.map((field) => [field.id, field]));
  const withImages = roles.some(
    (role, index) =>
      byId.get(fieldIdOf(role) ?? -1)?.type === CourseFieldTypeEnum.Image
      || (role === ColumnRoleEnum.New
        && newTypes[index] === CourseFieldTypeEnum.Image),
  );

  // a column picked as the name, the email or a field frees the one that had it
  const change = (index: number, role: ColumnRole) =>
    onRolesChange(
      roles.map((current, i) => {
        if (i === index) return role;
        const unique =
          role !== ColumnRoleEnum.New && role !== ColumnRoleEnum.Ignore;
        return unique && current === role ? ColumnRoleEnum.Ignore : current;
      }),
    );

  const addImages = async (files: File[]) => {
    setReading(true);
    setImageError(null);
    try {
      const added = await indexImages(files);
      const merged = new Map(images);
      for (const [key, list] of added) {
        merged.set(key, [...(merged.get(key) ?? []), ...list]);
      }
      onImagesChange(merged);
    } catch {
      setImageError(t('fieldImport.imagesUnreadable'));
    } finally {
      setReading(false);
    }
  };

  return (
    <Stack gap="lg">
      {problem !== null && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconAlertCircle size={18} stroke={1.5} />}
        >
          {t(problem, { max: MaxCourseFields })}
        </Alert>
      )}
      <Table.ScrollContainer minWidth={560}>
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('participantImport.column')}</Table.Th>
              <Table.Th>{t('participantImport.example')}</Table.Th>
              <Table.Th w={320}>{t('participantImport.use')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {table.headers.map((header, index) => {
              const role = roles[index] ?? ColumnRoleEnum.Ignore;
              const column =
                header || t('participantImport.untitled', { n: index + 1 });
              return (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {column}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {table.rows[0]?.cells[index] ?? ''}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Select
                        size="xs"
                        data={options}
                        value={role}
                        allowDeselect={false}
                        aria-label={t('participantImport.useOf', { column })}
                        onChange={(value) => {
                          if (value && isColumnRole(value))
                            change(index, value);
                        }}
                        style={{ flex: 1 }}
                      />
                      {role === ColumnRoleEnum.New && (
                        <Select
                          size="xs"
                          data={types}
                          value={newTypes[index] ?? CourseFieldTypeEnum.Text}
                          allowDeselect={false}
                          aria-label={t('fieldImport.newFieldType')}
                          onChange={(value) => {
                            const picked = types.find(
                              (type) => type.value === value,
                            );
                            if (picked) {
                              onNewTypesChange({
                                ...newTypes,
                                [index]: picked.value,
                              });
                            }
                          }}
                          w={120}
                        />
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {roles.includes(ColumnRoleEnum.New) && (
        <Text size="sm" c="dimmed">
          {t('fieldImport.newFieldsNote')}
        </Text>
      )}

      {withImages && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('fieldImport.imagesTitle')}
          </Text>
          {imageError !== null && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} stroke={1.5} />}
            >
              {imageError}
            </Alert>
          )}
          <Dropzone
            onDrop={(files) => void addImages(files)}
            onReject={() => setImageError(t('fieldImport.imagesRejected'))}
            loading={reading}
            multiple
            accept={{
              'image/png': ['.png'],
              'image/jpeg': ['.jpg', '.jpeg'],
              'application/zip': ['.zip'],
              'application/x-zip-compressed': ['.zip'],
            }}
          >
            <Group justify="center" gap="md" mih={80} wrap="nowrap">
              <IconPhoto
                size={32}
                stroke={1.5}
                color="var(--mantine-color-dimmed)"
              />
              <Stack gap={2}>
                <Text size="sm">{t('fieldImport.imagesDescription')}</Text>
                {images.size > 0 && (
                  <Text size="xs" c="dimmed">
                    {t('fieldImport.imagesReady', {
                      count: countImages(images),
                    })}
                  </Text>
                )}
              </Stack>
            </Group>
          </Dropzone>
        </Stack>
      )}

      <Radio.Group
        label={t('participantImport.modeLabel')}
        value={mode}
        onChange={(value) => {
          const picked = Object.values(ImportModeEnum).find((m) => m === value);
          if (picked) onModeChange(picked);
        }}
      >
        <Stack gap="sm" mt="xs">
          <Radio
            value={ImportModeEnum.Skip}
            label={t('participantImport.modeSkip')}
            description={t('participantImport.modeSkipDescription')}
          />
          <Radio
            value={ImportModeEnum.Update}
            label={t('participantImport.modeUpdate')}
            description={t('participantImport.modeUpdateDescription')}
          />
        </Stack>
      </Radio.Group>
    </Stack>
  );
}
