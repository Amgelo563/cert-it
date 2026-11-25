import {
  type CourseFieldSummary,
  type CourseFieldType,
  CourseFieldTypeEnum,
  MaxCourseFields,
  MaxFieldLabelLength,
} from '@cert-it/shared';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDown,
  IconArrowUp,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import type { ClientResponse } from 'hono/client';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../app/api/ApiClient';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiClient } from '../../app/api/useApiClient';

type CourseFieldsModalProps = {
  opened: boolean;
  courseId: number;
  fields: readonly CourseFieldSummary[];
  onClose: () => void;
  /** Called after any change, to load the fields again. */
  onChanged: () => void;
};

/** Lists a course's fields to add, rename, retype, reorder and delete them. */
export function CourseFieldsModal({
  opened,
  courseId,
  fields,
  onClose,
  onChanged,
}: CourseFieldsModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CourseFieldType>(CourseFieldTypeEnum.Text);
  const param = { courseId: String(courseId) };

  const types = useMemo(
    () =>
      Object.values(CourseFieldTypeEnum).map((value) => ({
        value,
        label: t(`courseFields.types.${value}`),
      })),
    [t],
  );

  // true once the change was saved; a failure is shown and gives false
  const run = async <R extends ClientResponse<any, any, any>>(
    task: (routes: ApiRoutes) => Promise<R>,
  ) => {
    setBusy(true);
    try {
      await api.request(task);
      onChanged();
      return true;
    } catch (error) {
      notifications.show({
        color: 'red',
        message: describeApiError(error, i18n),
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const added = await run((routes) =>
      routes.courses[':courseId'].fields.$post({
        param,
        json: { label: trimmed, type, required: false },
      }),
    );
    if (added) {
      notifications.show({
        color: 'teal',
        message: t('courseFields.added', { label: trimmed }),
      });
      setLabel('');
    }
  };

  const update = (
    field: CourseFieldSummary,
    json: { label?: string; type?: CourseFieldType; required?: boolean },
  ) =>
    run((routes) =>
      routes.courses[':courseId'].fields[':id'].$patch({
        param: { ...param, id: String(field.id) },
        json,
      }),
    );

  const move = (index: number, offset: number) => {
    const ids = fields.map((field) => field.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(index + offset, 0, moved);
    void run((routes) =>
      routes.courses[':courseId'].fields.order.$put({ param, json: { ids } }),
    );
  };

  const remove = (field: CourseFieldSummary) =>
    modals.openConfirmModal({
      title: t('courseFields.deleteTitle'),
      children: (
        <Text size="sm">
          {t('courseFields.deleteText', {
            label: field.label,
            count: field.valueCount,
          })}
        </Text>
      ),
      labels: { confirm: t('participants.delete'), cancel: t('auth.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        const deleted = await run((routes) =>
          routes.courses[':courseId'].fields[':id'].$delete({
            param: { ...param, id: String(field.id) },
          }),
        );
        if (deleted) {
          notifications.show({
            color: 'teal',
            message: t('courseFields.deleted', { label: field.label }),
          });
        }
      },
    });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('courseFields.title')}
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t('courseFields.description')}
        </Text>
        {fields.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            {t('courseFields.empty')}
          </Text>
        ) : (
          <Stack gap="sm">
            {fields.map((field, index) => (
              <FieldRow
                // a rename elsewhere resets the row
                key={`${field.id}:${field.label}`}
                field={field}
                types={types}
                busy={busy}
                first={index === 0}
                last={index === fields.length - 1}
                onRename={(next) => void update(field, { label: next })}
                onRetype={(next) => void update(field, { type: next })}
                onRequire={(next) => void update(field, { required: next })}
                onMove={(offset) => move(index, offset)}
                onDelete={() => remove(field)}
              />
            ))}
          </Stack>
        )}
        <Group
          gap="sm"
          align="flex-end"
          wrap="nowrap"
          pt="sm"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <TextInput
            label={t('courseFields.label')}
            value={label}
            maxLength={MaxFieldLabelLength}
            onChange={(event) => setLabel(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add();
            }}
            style={{ flex: 1 }}
          />
          <Select
            label={t('courseFields.type')}
            data={types}
            value={type}
            allowDeselect={false}
            onChange={(value) => {
              const picked = types.find((option) => option.value === value);
              if (picked) setType(picked.value);
            }}
            w={150}
          />
          <Button
            leftSection={<IconPlus size={16} stroke={1.5} />}
            loading={busy}
            disabled={!label.trim() || fields.length >= MaxCourseFields}
            onClick={() => void add()}
          >
            {t('courseFields.add')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type FieldRowProps = {
  field: CourseFieldSummary;
  types: { value: CourseFieldType; label: string }[];
  busy: boolean;
  first: boolean;
  last: boolean;
  onRename: (label: string) => void;
  onRetype: (type: CourseFieldType) => void;
  onRequire: (required: boolean) => void;
  onMove: (offset: number) => void;
  onDelete: () => void;
};

// the label saves once the input loses focus
function FieldRow({
  field,
  types,
  busy,
  first,
  last,
  onRename,
  onRetype,
  onRequire,
  onMove,
  onDelete,
}: FieldRowProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(field.label);
  const locked = field.valueCount > 0;

  const rename = () => {
    const trimmed = label.trim();
    if (trimmed && trimmed !== field.label) onRename(trimmed);
    else setLabel(field.label);
  };

  return (
    <Stack gap={4}>
      <Group gap="sm" wrap="nowrap" align="center">
        <TextInput
          aria-label={t('courseFields.label')}
          value={label}
          maxLength={MaxFieldLabelLength}
          onChange={(event) => setLabel(event.currentTarget.value)}
          onBlur={rename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          style={{ flex: 1 }}
        />
        <Tooltip label={t('courseFields.typeLocked')} disabled={!locked}>
          <div>
            <Select
              aria-label={t('courseFields.type')}
              data={types}
              value={field.type}
              allowDeselect={false}
              disabled={locked || busy}
              onChange={(value) => {
                const picked = types.find((option) => option.value === value);
                if (picked && picked.value !== field.type)
                  onRetype(picked.value);
              }}
              w={150}
            />
          </div>
        </Tooltip>
        <Tooltip label={t('courseFields.requiredDescription')}>
          <Switch
            label={t('courseFields.required')}
            checked={field.required}
            disabled={busy}
            onChange={(event) => onRequire(event.currentTarget.checked)}
          />
        </Tooltip>
        <Group gap={2} wrap="nowrap">
          <ActionIcon
            disabled={first || busy}
            aria-label={t('courseFields.moveUp', { label: field.label })}
            onClick={() => onMove(-1)}
          >
            <IconArrowUp size={16} stroke={1.5} />
          </ActionIcon>
          <ActionIcon
            disabled={last || busy}
            aria-label={t('courseFields.moveDown', { label: field.label })}
            onClick={() => onMove(1)}
          >
            <IconArrowDown size={16} stroke={1.5} />
          </ActionIcon>
          <ActionIcon
            color="red"
            disabled={busy}
            aria-label={t('courseFields.deleteOf', { label: field.label })}
            onClick={onDelete}
          >
            <IconTrash size={16} stroke={1.5} />
          </ActionIcon>
        </Group>
      </Group>
      {locked && (
        <Text size="xs" c="dimmed">
          {t('courseFields.valueCount', { count: field.valueCount })}
        </Text>
      )}
    </Stack>
  );
}
