import { Button, Menu } from '@mantine/core';
import {
  IconChevronDown,
  IconDownload,
  IconFileTypeCsv,
  IconFileZip,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { CertificateExportFormatEnum } from './CertificateExportFormatEnum';
import { certificateExportUrl } from './certificateExportUrl';

type CertificateExportMenuProps = {
  courseId: number;
  /** Active certificates, the only ones the ZIP holds. */
  activeCount: number;
};

/** Downloads a course's certificates: the active PDFs as a ZIP, or every code and URL as a CSV. */
export function CertificateExportMenu({
  courseId,
  activeCount,
}: CertificateExportMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu position="bottom-end" width={240}>
      <Menu.Target>
        <Button
          variant="light"
          leftSection={<IconDownload size={16} stroke={1.5} />}
          rightSection={<IconChevronDown size={16} stroke={1.5} />}
        >
          {t('certificates.export')}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {/* plain links, so the browser saves the stream straight to disk */}
        <Menu.Item
          component="a"
          href={certificateExportUrl(courseId, CertificateExportFormatEnum.Zip)}
          download
          disabled={activeCount === 0}
          leftSection={<IconFileZip size={16} stroke={1.5} />}
        >
          {t('certificates.exportZip')}
        </Menu.Item>
        <Menu.Item
          component="a"
          href={certificateExportUrl(courseId, CertificateExportFormatEnum.Csv)}
          download
          leftSection={<IconFileTypeCsv size={16} stroke={1.5} />}
        >
          {t('certificates.exportCsv')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
