import {
  type CourseFieldSummary,
  CourseFieldTypeEnum,
  type CourseSummary,
  type FieldValue,
  formatFieldValue,
} from '@cert-it/shared';
import { Image, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { fieldImageUrl } from './fieldImageUrl';

type FieldValueViewProps = {
  field: CourseFieldSummary;
  course: Pick<CourseSummary, 'id' | 'locale' | 'dateFormat'>;
  value: FieldValue | undefined;
};

/** A participant's value for one field, as the participants table shows it. */
export function FieldValueView({ field, course, value }: FieldValueViewProps) {
  const { t } = useTranslation();

  if (value === undefined) {
    return field.required ? (
      <Tooltip
        label={t('courseFields.missingRequired', { label: field.label })}
      >
        <ThemeIcon
          variant="light"
          color="orange"
          size="sm"
          aria-label={t('courseFields.missingRequired', { label: field.label })}
        >
          <IconAlertTriangle size={14} stroke={1.5} />
        </ThemeIcon>
      </Tooltip>
    ) : (
      <Text size="sm" c="dimmed">
        -
      </Text>
    );
  }

  switch (field.type) {
    case CourseFieldTypeEnum.Boolean:
      return value ? (
        <IconCheck
          size={18}
          stroke={1.5}
          color="var(--mantine-color-teal-6)"
          aria-label={t('courseFields.yes')}
        />
      ) : (
        <IconX
          size={18}
          stroke={1.5}
          color="var(--mantine-color-dimmed)"
          aria-label={t('courseFields.no')}
        />
      );
    case CourseFieldTypeEnum.Image:
      return (
        <Image
          src={fieldImageUrl(course.id, String(value))}
          alt={t('courseFields.imageAlt', { label: field.label })}
          h={32}
          w={32}
          fit="cover"
          radius="sm"
        />
      );
    default:
      return (
        <Text size="sm" lineClamp={2}>
          {formatFieldValue(field.type, value, course) ?? String(value)}
        </Text>
      );
  }
}
