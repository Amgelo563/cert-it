import type { Locale } from '@cert-it/shared';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** Returns a function that names a locale in the panel's language, such as Spanish or Español. */
export function useLocaleNames(): (locale: Locale) => string {
  const { i18n } = useTranslation();
  const names = useMemo(
    () => new Intl.DisplayNames([i18n.language], { type: 'language' }),
    [i18n.language],
  );

  return useCallback(
    (locale) => {
      const name = names.of(locale) ?? locale;
      return name.charAt(0).toLocaleUpperCase(i18n.language) + name.slice(1);
    },
    [names, i18n.language],
  );
}
