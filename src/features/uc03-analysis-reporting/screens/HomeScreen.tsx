import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  ChartNoAxesCombinedIcon,
  FileTextIcon,
  GaugeIcon,
  HandshakeIcon,
  RouteIcon,
  ServerCrashIcon,
  ShieldAlertIcon,
} from 'lucide-react-native';
import {
  ActionTile,
  Button,
  EmptyState,
  MetricCard,
  Notice,
  OfflineBanner,
  ReportCard,
  Screen,
  SectionHeader,
  Skeleton,
  useToast,
} from '@shared/components';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { useLookups } from '@shared/lookups/useLookups';
import { ROLE_LABELS } from '@shared/types';
import { getErrorMessage } from '@shared/utils/errors';
import { colors } from '@shared/theme';
import { HomeHeader } from '../components/HomeHeader';
import { dataRepository, type OverviewStats } from '../models/DataRepository';
import type { ReportRecord } from '../models/types';
import { useParkManager } from '../hooks/useParkManager';
import { useParkManagerNavigation } from '../navigation/types';
import { reportService } from '../services/ReportService';
import { reportMeta } from './reportFormat';

export function HomeScreen() {
  const navigation = useParkManagerNavigation();
  const manager = useParkManager();
  const { parkName } = useLookups();
  const { online } = useSync();
  const { tick } = useNotifications();
  const toast = useToast();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchAndApply = useCallback(
    () =>
      Promise.all([dataRepository.retrieveOverview(30), manager.reports(5)])
        .then(([overview, recent]) => {
          setStats(overview);
          setReports(recent);
          setError(null);
        })
        .catch((e: unknown) => setError(getErrorMessage(e, 'The operations overview could not be loaded.')))
        .finally(() => setLoading(false)),
    [manager],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetchAndApply();
  }, [fetchAndApply]);

  useEffect(() => {
    fetchAndApply();
  }, [fetchAndApply, tick]);

  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) fetchAndApply();
    wasOnline.current = online;
  }, [online, fetchAndApply]);

  const download = async (r: ReportRecord) => {
    setDownloading(r.report_id);
    try {
      await reportService.downloadReport(r.report_id);
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
    } finally {
      setDownloading(null);
    }
  };

  const subtitle = `${ROLE_LABELS[manager.role]} · Wildlife Conservation Officer`;
  const openAnalysis = () => navigation.navigate('Tabs', { screen: 'Analysis' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <HomeHeader name={manager.name} subtitle={subtitle} />
      <OfflineBanner />
      <Screen onRefresh={load} refreshing={loading && !!stats}>
        <SectionHeader title="Last 30 days" />
        {error && !stats ? (
          <Notice
            tone="critical"
            icon={ServerCrashIcon}
            title={online ? 'Overview unavailable' : 'You are offline'}
            message={online ? error : 'The operations overview needs a connection to the park server.'}
            action="Retry"
            onAction={load}
          />
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {stats ? (
                <>
                  <MetricCard label="Incidents reported" value={stats.incidents} icon={ShieldAlertIcon} tone="warn" sub="All parks" />
                  <MetricCard label="Patrols completed" value={stats.patrolsCompleted} icon={RouteIcon} tone="ok" sub="All parks" />
                </>
              ) : (
                <>
                  <Skeleton style={{ flex: 1, height: 96, borderRadius: 12 }} />
                  <Skeleton style={{ flex: 1, height: 96, borderRadius: 12 }} />
                </>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {stats ? (
                <>
                  <MetricCard
                    label="Avg. patrol coverage"
                    value={stats.avgCoverage === null ? '—' : `${stats.avgCoverage}%`}
                    icon={GaugeIcon}
                    sub="Completed patrols"
                  />
                  <MetricCard label="Conflict reports" value={stats.conflictReports} icon={HandshakeIcon} tone="critical" sub="Community & SMS" />
                </>
              ) : (
                <>
                  <Skeleton style={{ flex: 1, height: 96, borderRadius: 12 }} />
                  <Skeleton style={{ flex: 1, height: 96, borderRadius: 12 }} />
                </>
              )}
            </View>
            {error && stats ? <Notice tone="warn" message={error} action="Retry" onAction={load} /> : null}
          </View>
        )}

        <SectionHeader title="Data Analysis & Reporting" style={{ marginTop: 24 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ActionTile icon={ChartNoAxesCombinedIcon} label="New analysis" sub="Incidents, patrols, conflicts" tone="solid" onPress={openAnalysis} />
          <ActionTile icon={FileTextIcon} label="Reports library" sub="Generated PDF reports" onPress={() => navigation.navigate('Tabs', { screen: 'Reports' })} />
        </View>

        <SectionHeader
          title="Recent reports"
          action={reports.length ? 'All reports' : undefined}
          onAction={() => navigation.navigate('Tabs', { screen: 'Reports' })}
          style={{ marginTop: 24 }}
        />
        {loading && !stats ? (
          <View style={{ gap: 12 }}>
            <Skeleton style={{ height: 72, borderRadius: 12 }} />
            <Skeleton style={{ height: 72, borderRadius: 12 }} />
          </View>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileTextIcon}
            title="No reports yet"
            message="Run a data analysis and tap Generate Report to create your first conservation report."
            actionLabel="Start an analysis"
            onAction={openAnalysis}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {reports.map((r) => (
              <ReportCard
                key={r.report_id}
                title={r.title}
                type={r.report_type}
                meta={reportMeta(r, parkName)}
                onPress={() => navigation.navigate('ReportDetail', { reportId: r.report_id })}
                onDownload={downloading ? undefined : () => download(r)}
              />
            ))}
          </View>
        )}
        {reports.length ? (
          <Button variant="ghost" full onPress={openAnalysis} style={{ marginTop: 12 }}>
            Run another analysis
          </Button>
        ) : null}
      </Screen>
    </View>
  );
}
