import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardListIcon, CopyIcon, InboxIcon, ShieldAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BellButton,
  Card,
  EmptyState,
  LoadingBlock,
  MapLegend,
  MapPanel,
  MetricCard,
  OfflineBanner,
  Screen,
  SectionHeader,
  type MapPoint,
} from '@shared/components';
import { colors } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { firstName } from '@shared/utils/format';
import { useOfficer } from '../hooks/useOfficer';
import { useRemote } from '../hooks/useRemote';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { fetchOpenReports, type ReportFilter } from '../services/reportService';
import { LoadError, RefreshError } from '../components/LoadState';
import { ReportRecordCard, reportMarker, reportPlace } from '../components/ReportRecordCard';
import type { CloNavigation } from '../navigation/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardScreen() {
  const navigation = useNavigation<CloNavigation>();
  const officer = useOfficer();
  const { tick } = useNotifications();
  const { zoneName } = useLookups();
  const { data, error, loading, refreshing, reload, refetch, retry } = useRemote(fetchOpenReports, [tick]);
  useRealtimeRefresh(['community_reports', 'response_assignments'], refetch);

  const reports = useMemo(() => data ?? [], [data]);
  const stats = useMemo(
    () => ({
      fresh: reports.filter((r) => r.status === 'Reported'),
      review: reports.filter((r) => r.status === 'Under Review').length,
      highRisk: reports.filter((r) => r.isHighRisk),
      responding: reports.filter((r) => r.status === 'Responding').length,
      duplicates: reports.filter((r) => r.isPossibleDuplicate).length,
    }),
    [reports],
  );

  const openReport = (reportId: string) => navigation.push('ReportReview', { reportId });
  const openList = (filter: ReportFilter) => navigation.navigate('Tabs', { screen: 'Reports', params: { filter, at: Date.now() } });

  const markers = useMemo(
    () =>
      reports
        .map((r) => reportMarker(r, () => navigation.push('ReportReview', { reportId: r.reportId })))
        .filter((m): m is MapPoint => m !== null),
    [reports, navigation],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        tone="dark"
        hideBack
        title={`${greeting()}, ${firstName(officer.name) || 'Officer'}`}
        subtitle={`Community Liaison Officer${officer.assignedArea ? ` · ${officer.assignedArea}` : ''}`}
        right={<BellButton tone="onDark" />}
      />
      <OfflineBanner />
      <Screen onRefresh={reload} refreshing={refreshing}>
        {loading ? (
          <LoadingBlock label="Loading operations dashboard…" />
        ) : error && !data ? (
          <LoadError error={error} onRetry={retry} title="Couldn't load the dashboard" />
        ) : (
          <>
            {error ? <RefreshError error={error} onRetry={reload} /> : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <MetricCard
                label="New reports"
                value={stats.fresh.length}
                icon={InboxIcon}
                tone="info"
                sub="Awaiting review"
                onPress={() => openList('New')}
              />
              <MetricCard
                label="Under review"
                value={stats.review}
                icon={ClipboardListIcon}
                tone="warn"
                sub="Severity to assess"
                onPress={() => openList('Under Review')}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <MetricCard
                label="High-risk active"
                value={stats.highRisk.length}
                icon={ShieldAlertIcon}
                tone="critical"
                sub={`${stats.responding} responding`}
                onPress={() => openList('Responding')}
              />
              <MetricCard
                label="Possible duplicates"
                value={stats.duplicates}
                icon={CopyIcon}
                tone="warn"
                sub="Flagged for review"
                onPress={() => openList('Duplicates')}
              />
            </View>

            <Card style={{ marginTop: 16, overflow: 'hidden' }}>
              <MapPanel height={180} rounded={false} markers={markers}>
                <View style={{ position: 'absolute', left: 8, bottom: 8 }} pointerEvents="none">
                  <MapLegend
                    items={[
                      { color: colors.warn, label: 'Conflict report' },
                      { color: colors.crit, label: 'High risk' },
                    ]}
                  />
                </View>
              </MapPanel>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 }}>
                <AppText size={13} weight="medium">
                  Open reports on the map
                </AppText>
                <AppText size={12} color={colors.muted}>
                  {markers.length} of {reports.length} with GPS
                </AppText>
              </View>
            </Card>

            {stats.highRisk.length ? (
              <View style={{ marginTop: 20 }}>
                <SectionHeader title="High-risk conflicts" action="Responding" onAction={() => openList('Responding')} />
                <View style={{ gap: 12 }}>
                  {stats.highRisk.slice(0, 3).map((r) => (
                    <ReportRecordCard key={r.reportId} report={r} place={reportPlace(r, zoneName)} onPress={() => openReport(r.reportId)} />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: 20 }}>
              <SectionHeader title="New reports" action="All reports" onAction={() => openList('New')} />
              {stats.fresh.length ? (
                <View style={{ gap: 12 }}>
                  {stats.fresh.slice(0, 5).map((r) => (
                    <ReportRecordCard key={r.reportId} report={r} place={reportPlace(r, zoneName)} onPress={() => openReport(r.reportId)} />
                  ))}
                </View>
              ) : (
                <Card>
                  <EmptyState icon={InboxIcon} title="No new reports" message="New human-wildlife conflict reports from the community appear here." />
                </Card>
              )}
            </View>
          </>
        )}
      </Screen>
    </View>
  );
}
