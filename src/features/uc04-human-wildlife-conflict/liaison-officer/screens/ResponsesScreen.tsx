import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SirenIcon } from 'lucide-react-native';
import { AppBar, BellButton, EmptyState, FilterChips, LoadingBlock, OfflineBanner, Screen } from '@shared/components';
import { colors } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { relativeTime } from '@shared/utils/format';
import { useRemote } from '../hooks/useRemote';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { fetchResponses, type ResponseItem } from '../services/reportService';
import type { ResponseStatus } from '../services/rows';
import { LoadError, RefreshError } from '../components/LoadState';
import { ReportRecordCard, reportPlace } from '../components/ReportRecordCard';
import type { CloNavigation } from '../navigation/types';

type ResponseFilter = 'Active' | ResponseStatus;
const FILTERS: readonly ResponseFilter[] = ['Active', 'Assigned', 'Acknowledged', 'Responding', 'Resolved'];

const matches = (item: ResponseItem, f: ResponseFilter) =>
  f === 'Active' ? item.assignment.responseStatus !== 'Resolved' : item.assignment.responseStatus === f;

export function ResponsesScreen() {
  const navigation = useNavigation<CloNavigation>();
  const { tick } = useNotifications();
  const { zoneName } = useLookups();
  const [filter, setFilter] = useState<ResponseFilter>('Active');
  const { data, error, loading, refreshing, reload, refetch, retry } = useRemote(() => fetchResponses('All'), [tick]);
  useRealtimeRefresh(['response_assignments'], refetch);

  const items = useMemo(() => data ?? [], [data]);
  const labels = useMemo(() => {
    const l: Partial<Record<ResponseFilter, string>> = {};
    FILTERS.forEach((f) => {
      l[f] = `${f} (${items.filter((i) => matches(i, f)).length})`;
    });
    return l;
  }, [items]);
  const list = items.filter((i) => matches(i, filter));

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Responses" subtitle="Coordinated ranger field responses" hideBack right={<BellButton />} border={false} />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} labels={data ? labels : undefined} />
      </View>
      <OfflineBanner />
      <Screen onRefresh={reload} refreshing={refreshing}>
        {loading ? (
          <LoadingBlock label="Loading responses…" />
        ) : error && !data ? (
          <LoadError error={error} onRetry={retry} title="Couldn't load responses" />
        ) : (
          <>
            {error ? <RefreshError error={error} onRetry={reload} /> : null}
            {list.length === 0 ? (
              <EmptyState
                icon={SirenIcon}
                title={filter === 'Active' ? 'No active responses' : `No ${filter.toLowerCase()} responses`}
                message="Responses you coordinate for high-risk conflict reports appear here."
              />
            ) : (
              <View style={{ gap: 12 }}>
                {list.map(({ assignment, report }) => (
                  <ReportRecordCard
                    key={assignment.assignmentId ?? report.reportId}
                    report={report}
                    place={reportPlace(report, zoneName)}
                    subtitle={`${assignment.rangerName} · assigned ${relativeTime(assignment.assignedAt)}`}
                    badges={[assignment.responseStatus, ...(report.isHighRisk ? ['High Risk'] : []), ...(report.severity ? [report.severity] : [])]}
                    onPress={() => assignment.assignmentId && navigation.push('ResponseTracking', { assignmentId: assignment.assignmentId })}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </Screen>
    </View>
  );
}
