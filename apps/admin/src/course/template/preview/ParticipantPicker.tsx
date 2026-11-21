import type { ParticipantSummary } from '@cert-it/shared';
import { Select } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../../app/api/ApiClient';
import { useApiRequest } from '../../../app/api/useApiRequest';

type ParticipantPickerProps = {
  courseId: number;
  value: ParticipantSummary | null;
  onChange: (participant: ParticipantSummary | null) => void;
};

// enough to find someone by typing, without paging
const ResultSize = 20;

const SearchDelayMs = 300;

/** A search box over a course's participants, searched on the server. */
export function ParticipantPicker({
  courseId,
  value,
  onChange,
}: ParticipantPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search.trim(), SearchDelayMs);
  // picking puts the label in the box, which isn't a search, also right after clearing it
  const [picked, setPicked] = useState<string | null>(null);
  const query =
    debouncedSearch === picked
    || (value !== null && debouncedSearch === labelOf(value))
      ? ''
      : debouncedSearch;

  const request = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.courses[':courseId'].participants.$get({
          param: { courseId: String(courseId) },
          query: {
            page: '1',
            size: String(ResultSize),
            ...(query ? { search: query } : {}),
          },
        }),
      [courseId, query],
    ),
  );

  // the picked one stays an option while other results show
  const found = request.data?.items ?? [];
  const options =
    value && !found.some((participant) => participant.id === value.id)
      ? [value, ...found]
      : found;

  return (
    <Select
      searchable
      clearable
      label={t('template.preview.participant')}
      placeholder={t('template.preview.searchParticipant')}
      leftSection={<IconSearch size={16} stroke={1.5} />}
      nothingFoundMessage={
        request.loading ? undefined : t('template.preview.noParticipants')
      }
      data={options.map((participant) => ({
        value: String(participant.id),
        label: labelOf(participant),
      }))}
      // the server already searched
      filter={({ options: all }) => all}
      value={value ? String(value.id) : null}
      onChange={(id) => {
        const chosen =
          options.find((participant) => String(participant.id) === id) ?? null;
        // clearing leaves the old label in the box for a moment
        const shown = chosen ?? value;
        if (shown) setPicked(labelOf(shown));
        onChange(chosen);
      }}
      searchValue={search}
      onSearchChange={setSearch}
      error={request.error ? t('template.preview.searchFailed') : undefined}
    />
  );
}

function labelOf(participant: ParticipantSummary): string {
  return `${participant.name} (${participant.email})`;
}
