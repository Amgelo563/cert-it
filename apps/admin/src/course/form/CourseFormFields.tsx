import { CourseDateFormatter, LocaleEnum } from '@cert-it/shared';
import { Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocaleNames } from '../../app/i18n/useLocaleNames';
import type { CourseForm } from './useCourseForm';

type CourseFormFieldsProps = {
  form: CourseForm;
  /** Focuses the name field when shown, such as in a modal. */
  focusName?: boolean;
};

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The fields of a course: name, language, date format with a preview, and lookup listing. */
export function CourseFormFields({ form, focusName }: CourseFormFieldsProps) {
  const { t } = useTranslation();
  const localeNames = useLocaleNames();

  const locales = useMemo(
    () =>
      Object.values(LocaleEnum).map((locale) => ({
        value: locale,
        label: localeNames(locale),
      })),
    [localeNames],
  );

  const preview = useMemo(() => {
    const format = form.values.dateFormat.trim();
    if (!format) return null;
    return new CourseDateFormatter({
      locale: form.values.locale,
      dateFormat: format,
    }).format(today());
  }, [form.values.dateFormat, form.values.locale]);

  // a format still at the old language's default follows the new language
  const changeLocale = (value: string | null) => {
    const locale = Object.values(LocaleEnum).find((l) => l === value);
    if (!locale) return;
    const previousDefault =
      CourseDateFormatter.DefaultFormats[form.values.locale];
    form.setFieldValue('locale', locale);
    if (form.values.dateFormat.trim() === previousDefault) {
      form.setFieldValue(
        'dateFormat',
        CourseDateFormatter.DefaultFormats[locale],
      );
    }
  };

  return (
    <Stack gap="md">
      <TextInput
        label={t('courses.name')}
        maxLength={200}
        required
        data-autofocus={focusName}
        {...form.getInputProps('name')}
      />
      <Select
        label={t('courses.locale')}
        description={t('courses.localeDescription')}
        data={locales}
        allowDeselect={false}
        required
        value={form.values.locale}
        onChange={changeLocale}
      />
      <Stack gap={6}>
        <TextInput
          label={t('courses.dateFormat')}
          description={t('courses.dateFormatDescription')}
          maxLength={64}
          required
          {...form.getInputProps('dateFormat')}
        />
        {preview && (
          <Text size="sm" c="dimmed" aria-live="polite">
            {t('courses.datePreview', { date: preview })}
          </Text>
        )}
      </Stack>
      <Switch
        label={t('courses.lookupEnabled')}
        description={t('courses.lookupDescription')}
        {...form.getInputProps('lookupEnabled', { type: 'checkbox' })}
      />
    </Stack>
  );
}
