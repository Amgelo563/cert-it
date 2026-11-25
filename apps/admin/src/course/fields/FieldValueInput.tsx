import {
  type CourseFieldSummary,
  CourseFieldTypeEnum,
  type CourseSummary,
  type FieldValue,
  MaxFieldTextLength,
  MaxImageBytes,
} from '@cert-it/shared';
import {
  Button,
  FileButton,
  Group,
  Image,
  Input,
  NumberInput,
  SegmentedControl,
  Stack,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCalendar, IconPhoto, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiClient } from '../../app/api/useApiClient';
import { fieldImageUrl } from './fieldImageUrl';

type FieldValueInputProps = {
  field: CourseFieldSummary;
  course: Pick<CourseSummary, 'id' | 'locale' | 'dateFormat'>;
  /** The current value, or undefined when there's none. */
  value: FieldValue | undefined;
  /** Called with the new value, or undefined to clear it. */
  onChange: (value: FieldValue | undefined) => void;
  error?: string;
};

const ImageTypes = ['image/png', 'image/jpeg'];

const UnsetValue = 'unset';

/** An input for one course field's value, by the field's type. */
export function FieldValueInput({
  field,
  course,
  value,
  onChange,
  error,
}: FieldValueInputProps) {
  const { t, i18n } = useTranslation();
  const common = {
    label: field.label,
    required: field.required,
    error,
  };

  switch (field.type) {
    case CourseFieldTypeEnum.Text:
      return (
        <TextInput
          {...common}
          maxLength={MaxFieldTextLength}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.currentTarget.value || undefined)}
        />
      );
    case CourseFieldTypeEnum.Number:
      return (
        <NumberInput
          {...common}
          // the separator the editor types in their language
          decimalSeparator={i18n.language === 'es' ? ',' : '.'}
          value={typeof value === 'number' ? value : ''}
          onChange={(next) =>
            onChange(typeof next === 'number' ? next : undefined)
          }
        />
      );
    case CourseFieldTypeEnum.Date:
      return (
        <DatePickerInput
          {...common}
          placeholder={t('courseFields.datePlaceholder')}
          value={typeof value === 'string' ? value : null}
          onChange={(next) => onChange(next ?? undefined)}
          valueFormat={course.dateFormat}
          locale={course.locale}
          leftSection={<IconCalendar size={16} stroke={1.5} />}
          clearable
          popoverProps={{ withinPortal: true }}
        />
      );
    case CourseFieldTypeEnum.Boolean:
      return (
        <Input.Wrapper {...common}>
          <SegmentedControl
            display="flex"
            mt={4}
            value={typeof value === 'boolean' ? String(value) : UnsetValue}
            onChange={(next) =>
              onChange(next === UnsetValue ? undefined : next === 'true')
            }
            data={[
              { value: 'true', label: t('courseFields.yes') },
              { value: 'false', label: t('courseFields.no') },
              { value: UnsetValue, label: t('courseFields.notSet') },
            ]}
          />
        </Input.Wrapper>
      );
    case CourseFieldTypeEnum.Image:
      return (
        <ImageValueInput
          {...common}
          courseId={course.id}
          value={typeof value === 'string' ? value : undefined}
          onChange={onChange}
          describeError={(caught) => describeApiError(caught, i18n)}
        />
      );
  }
}

type ImageValueInputProps = {
  label: string;
  required: boolean;
  error?: string;
  courseId: number;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  describeError: (error: unknown) => string;
};

// uploaded as soon as it's picked; an image never saved is removed by the server later
function ImageValueInput({
  label,
  required,
  error,
  courseId,
  value,
  onChange,
  describeError,
}: ImageValueInputProps) {
  const { t } = useTranslation();
  const api = useApiClient();
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | null) => {
    if (!file) return;
    if (!ImageTypes.includes(file.type) || file.size > MaxImageBytes) {
      notifications.show({
        color: 'red',
        message: t('courseFields.imageRejected'),
      });
      return;
    }
    setUploading(true);
    try {
      const { image } = await api.request((routes) =>
        routes.courses[':courseId'].images.$post(
          { param: { courseId: String(courseId) } },
          { headers: { 'Content-Type': file.type }, init: { body: file } },
        ),
      );
      onChange(image);
    } catch (caught) {
      notifications.show({ color: 'red', message: describeError(caught) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Input.Wrapper label={label} required={required} error={error}>
      <Stack gap="xs" mt={4}>
        {value && (
          <Image
            src={fieldImageUrl(courseId, value)}
            alt={t('courseFields.imageAlt', { label })}
            h={96}
            w="auto"
            fit="contain"
            radius="sm"
            style={{ alignSelf: 'flex-start' }}
          />
        )}
        <Group gap="xs">
          <FileButton
            onChange={(file) => void upload(file)}
            accept={ImageTypes.join(',')}
          >
            {(props) => (
              <Button
                {...props}
                variant="default"
                size="xs"
                loading={uploading}
                leftSection={<IconPhoto size={14} stroke={1.5} />}
              >
                {value
                  ? t('courseFields.replaceImage')
                  : t('courseFields.uploadImage')}
              </Button>
            )}
          </FileButton>
          {value && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              leftSection={<IconTrash size={14} stroke={1.5} />}
              onClick={() => onChange(undefined)}
            >
              {t('courseFields.removeImage')}
            </Button>
          )}
        </Group>
      </Stack>
    </Input.Wrapper>
  );
}
