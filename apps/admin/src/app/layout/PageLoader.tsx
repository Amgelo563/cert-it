import { Center, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';

/** Shown while a page's chunk loads. */
export function PageLoader() {
  const { t } = useTranslation();

  return (
    <Center mih="60vh">
      <Loader aria-label={t('app.loading')} />
    </Center>
  );
}
