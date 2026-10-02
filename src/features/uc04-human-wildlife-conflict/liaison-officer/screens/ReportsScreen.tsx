import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CopyIcon, InboxIcon, SearchIcon } from 'lucide-react-native';
import { AppBar, BellButton, EmptyState, FilterChips, Input, LoadingBlock, OfflineBanner, Screen } from '@shared/components';
import { colors } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { useRemote } from '../hooks/useRemote';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { fetchReports, REPORT_FILTERS, type ReportFilter } from '../services/reportService';
import { LoadError, RefreshError } from '../components/LoadState';
import { ReportRecordCard, reportPlace } from '../components/ReportRecordCard';
import type { CloNavigation, CloTabParamList } from '../navigation/types';

const EMPTY: Record<ReportFilter, { title: string; message: string }> = {
  New: { title: 'No new reports', message: 'Newly submitted conflict reports appear here until you open them.' },
  'Under Review': { title: 'Nothing under review', message: 'Reports you have opened but not yet resolved appear here.' },
  Responding: { title: 'No active responses', message: 'High-risk reports with a coordinated ranger response appear here.' },
  Closed: { title: 'No closed reports', message: 'Resolved and closed reports appear here.' },
  Duplicates: { title: 'No duplicates', message: 'Reports the system flags as similar to a recent report appear here.' },
};

export function ReportsScreen({ route }: BottomTabScreenProps<CloTabParamList, 'Reports'>) {
  const navigation = useNavigation<CloNavigation>();
  const { tick } = useNotifications();
  const { zoneName } = useLookups();
  const [filter, setFilter] = useState<ReportFilter>(route.params?.filter ?? 'New');
  const [query, setQuery] = useState('');

  // `at` lets another screen re-apply the same filter the user has since changed.
  const paramKey = `${route.params?.filter ?? ''}:${route.params?.at ?? ''}`;
  const [appliedParamKey, setAppliedParamKey] = useState(paramKey);
  if (paramKey !== appliedParamKey) {
    setAppliedParamKey(paramKey);
    if (route.params?.filter) setFilter(route.params.filter);
  }

  const { data, error, loading, refreshing, reload, refetch, retry } = useRemote(() => fetchReports(filter), [filter, tick], filter);
  useRealtimeRefresh(['community_reports'], refetch);

  const list = useMemo(() => {
    const all = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    const digits = q.replace(/\D/g, '');
    return all.filter(
      (r) =>
        (digits.length > 0 && String(r.reportNo).includes(String(Number(digits)))) ||
        r.code.toLowerCase().includes(q) ||
        r.conflictType.getTypeName().toLowerCase().includes(q) ||
        (r.village ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Conflict reports" subtitle="Human-wildlife conflict (UC-04)" hideBack right={<BellButton />} border={false} />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Input
          icon={SearchIcon}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by code, type or village"
          autoCapitalize="none"
          returnKeyType="search"
        />
        <FilterChips options={REPORT_FILTERS} value={filter} onChange={setFilter} />
      </View>
      <OfflineBanner />
      <Screen onRefresh={reload} refreshing={refreshing}>
        {loading ? (
          <LoadingBlock label="Loading reports…" />
        ) : error && !data ? (
          <LoadError error={error} onRetry={retry} title="Couldn't load reports" />
        ) : (
          <>
            {error ? <RefreshError error={error} onRetry={reload} /> : null}
            {list.length === 0 ? (
              query.trim() ? (
                <EmptyState icon={SearchIcon} title="No matching reports" message={`Nothing in "${filter}" matches "${query.trim()}".`} actionLabel="Clear search" onAction={() => setQuery('')} />
              ) : (
                <EmptyState icon={filter === 'Duplicates' ? CopyIcon : InboxIcon} title={EMPTY[filter].title} message={EMPTY[filter].message} />
              )
            ) : (
              <View style={{ gap: 12 }}>
                {list.map((r) => (
                  <ReportRecordCard
                    key={r.reportId}
                    report={r}
                    place={reportPlace(r, zoneName)}
                    onPress={() => navigation.push('ReportReview', { reportId: r.reportId })}
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
