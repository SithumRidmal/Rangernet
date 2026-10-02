import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { ClipboardListIcon, CloudUploadIcon, PawPrintIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  BellButton,
  Button,
  EmptyState,
  FilterChips,
  LoadingBlock,
  Notice,
  OfflineBanner,
  Screen,
  StickyFooter,
} from '@shared/components';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { relativeTime } from '@shared/utils/format';
import { useMyReports, type ReportListItem } from '../services/useMyReports';
import { ReportListCard } from '../components/ReportListCard';
import { useCommunityNavigation, type CommunityTabParamList, type ReportFilter } from '../navigation/types';

const FILTERS: readonly ReportFilter[] = ['All', 'Pending Sync', 'Open', 'Resolved'];

function matches(item: ReportListItem, filter: ReportFilter): boolean {
  switch (filter) {
    case 'Pending Sync':
      return item.source === 'local';
    case 'Open':
      return item.source === 'server' && item.report.isOpen();
    case 'Resolved':
      return item.source === 'server' && item.report.isResolved();
    default:
      return true;
  }
}

const EMPTY: Record<ReportFilter, { title: string; message: string }> = {
  All: { title: 'No reports yet', message: 'Reports you send from the app or by SMS from your registered number appear here.' },
  'Pending Sync': { title: 'Nothing waiting to sync', message: 'Reports saved while offline appear here until they are sent.' },
  Open: { title: 'No open reports', message: 'Reports that are being reviewed or responded to appear here.' },
  Resolved: { title: 'No resolved reports', message: 'Reports that were resolved or closed appear here.' },
};

export function MyReportsScreen() {
  const navigation = useCommunityNavigation();
  const route = useRoute<RouteProp<CommunityTabParamList, 'MyReports'>>();
  const { syncNow, online } = useSync();
  const { items, loading, refreshing, error, cachedAt, refresh } = useMyReports();
  const [filter, setFilter] = useState<ReportFilter>(route.params?.filter ?? 'All');
  const [paramFilter, setParamFilter] = useState(route.params?.filter);
  if (route.params?.filter !== paramFilter) {
    setParamFilter(route.params?.filter);
    if (route.params?.filter) setFilter(route.params.filter);
  }

  const list = useMemo(() => items.filter((i) => matches(i, filter)), [items, filter]);
  const failedCount = items.filter((i) => i.source === 'local' && i.outbox.status === 'failed').length;
  const pendingCount = items.filter((i) => i.source === 'local').length;

  const onRefresh = async () => {
    if (online && pendingCount) await syncNow().catch(() => undefined);
    await refresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="My Reports" subtitle={`${items.length} report${items.length === 1 ? '' : 's'}`} right={<BellButton />} hideBack border={false} />
      <OfflineBanner />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <FilterChips
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          labels={{ 'Pending Sync': pendingCount ? `Pending Sync (${pendingCount})` : 'Pending Sync' }}
        />
      </View>
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        {failedCount ? (
          <Notice
            tone="critical"
            icon={TriangleAlertIcon}
            title={`${failedCount} report${failedCount === 1 ? '' : 's'} could not be sent`}
            message="They are kept on this device. Open the report to see why, or retry from the Sync Center."
            action="Open Sync Center"
            onAction={() => navigation.navigate('SyncCenter')}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        {pendingCount && !failedCount && filter !== 'Resolved' ? (
          <Notice
            tone="warn"
            icon={CloudUploadIcon}
            message={`${pendingCount} report${pendingCount === 1 ? ' is' : 's are'} saved on this device and will be sent automatically${online ? '' : ' when you are back online'}.`}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        {cachedAt ? (
          <Notice tone="info" message={`You are viewing reports saved ${relativeTime(cachedAt)}. Pull down to refresh.`} style={{ marginBottom: 12 }} />
        ) : error ? (
          <Notice tone="critical" title="Could not load your reports" message={error} action="Try again" onAction={refresh} style={{ marginBottom: 12 }} />
        ) : null}

        {loading ? (
          <LoadingBlock label="Loading your reports…" />
        ) : list.length === 0 ? (
          <EmptyState
            icon={filter === 'Pending Sync' ? CloudUploadIcon : ClipboardListIcon}
            title={EMPTY[filter].title}
            message={EMPTY[filter].message}
            actionLabel={filter === 'All' ? 'Report a conflict' : undefined}
            onAction={() => navigation.navigate('ReportType')}
          />
        ) : (
          <View style={{ gap: 10 }}>
            {list.map((item) => (
              <ReportListCard
                key={item.report.reportId}
                item={item}
                onPress={() => navigation.navigate('ReportDetail', { reportId: item.report.reportId })}
              />
            ))}
          </View>
        )}
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={PawPrintIcon} onPress={() => navigation.navigate('ReportType')}>
          Report a conflict
        </Button>
      </StickyFooter>
    </View>
  );
}
