import {
  type ImportMode,
  ImportModeEnum,
  MaxImportExtraColumns,
} from '@cert-it/shared';
import { Alert, Radio, Select, Stack, Table, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { columnsProblem } from '../columnsProblem';
import { type ColumnRole, ColumnRoleEnum } from '../ColumnRoleEnum';
import type { CsvTable } from '../CsvTable';

type ColumnsStepProps = {
  table: CsvTable;
  roles: readonly ColumnRole[];
  mode: ImportMode;
  onRolesChange: (roles: ColumnRole[]) => void;
  onModeChange: (mode: ImportMode) => void;
};

/** Which column holds what, with a value from the first row, and what to do with emails already in the course. */
export function ColumnsStep({
  table,
  roles,
  mode,
  onRolesChange,
  onModeChange,
}: ColumnsStepProps) {
  const { t } = useTranslation();
  const problem = columnsProblem(roles);

  const options = useMemo(
    () =>
      Object.values(ColumnRoleEnum).map((role) => ({
        value: role,
        label: t(`participantImport.roles.${role}`),
      })),
    [t],
  );

  // a column picked as name or email frees the one that had it
  const change = (index: number, role: ColumnRole) =>
    onRolesChange(
      roles.map((current, i) => {
        if (i === index) return role;
        const unique =
          role === ColumnRoleEnum.Name || role === ColumnRoleEnum.Email;
        return unique && current === role ? ColumnRoleEnum.Extra : current;
      }),
    );

  return (
    <Stack gap="lg">
      {problem !== null && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconAlertCircle size={18} stroke={1.5} />}
        >
          {t(problem, { max: MaxImportExtraColumns })}
        </Alert>
      )}
      <Table.ScrollContainer minWidth={480}>
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('participantImport.column')}</Table.Th>
              <Table.Th>{t('participantImport.example')}</Table.Th>
              <Table.Th w={200}>{t('participantImport.use')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {table.headers.map((header, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {header
                      || t('participantImport.untitled', { n: index + 1 })}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {table.rows[0]?.cells[index] ?? ''}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={options}
                    value={roles[index] ?? ColumnRoleEnum.Ignore}
                    allowDeselect={false}
                    aria-label={t('participantImport.useOf', {
                      column: header || index + 1,
                    })}
                    onChange={(value) => {
                      const role = Object.values(ColumnRoleEnum).find(
                        (r) => r === value,
                      );
                      if (role) change(index, role);
                    }}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

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
