import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart3Icon, DatabaseIcon, DownloadIcon, FileTextIcon, LightbulbIcon, Trash2Icon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  KeyValue,
  ListRow,
  LoadingBlock,
  MetricCard,
  Modal,
  OfflineBanner,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  useToast,
} from '@shared/components';
import { useProfile } from '@shared/auth/AuthProvider';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { formatCode, formatCoord, formatDateTime } from '@shared/utils/format';
import { StateView } from '../components/StateView';
import { ANALYSIS_TYPE_LABELS, type ReportRecord } from '../models/types';
import type { ParkManagerStackParamList } from '../navigation/types';
import { formatRange } from '../services/dates';
import { reportService } from '../services/ReportService';
import { formatBytes, reportParks } from './reportFormat';

type Props = NativeStackScreenProps<ParkManagerStackParamList, 'ReportDetail'>;

/** Report detail: parameters, summary metrics, download (UC-03 step 7) and delete. */
export function ReportDetailScreen({ navigation, route }: Props) {
  const { reportId } = route.params;
  const profile = useProfile();
  const { parkName, zoneName } = useLookups();
  const { online } = useSync();
  const toast = useToast();
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const settle = useCallback(
    (task: ReturnType<typeof reportService.getReport>) =>
      task
        .then(setReport)
        .catch((e: unknown) => setError(getErrorMessage(e, 'The report could not be loaded.')))
        .finally(() => setLoading(false)),
    [],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return settle(reportService.getReport(reportId));
  }, [reportId, settle]);

  useEffect(() => {
    settle(reportService.getReport(reportId));
  }, [reportId, settle]);

  const download = async () => {
    setDownloading(true);
    try {
      await reportService.downloadReport(reportId);
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
    } finally {
      setDownloading(false);
    }
  };

  const remove = async () => {
    if (!report) return;
    setDeleting(true);
    try {
      await reportService.deleteReport(report);
      setConfirmDelete(false);
      toast.show(`${formatCode('RPT', report.report_no)} deleted`, 'ok');
      navigation.goBack();
    } catch (e) {
      toast.show(getErrorMessage(e, 'The report could not be deleted.'), 'critical');
    } finally {
      setDeleting(false);
    }
  };

  if (error) {
    return (
      <StateView
        appBarTitle="Report"
        icon={DatabaseIcon}
        tone="critical"
        title="Report could not be loaded"
        message={online ? error : 'You are offline. Connect to the park server to open this report.'}
        primaryLabel="Retry"
        onPrimary={load}
      />
    );
  }

  if (loading || !report) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Report" />
        <OfflineBanner />
        {loading ? (
          <LoadingBlock label="Loading report…" />
        ) : (
          <EmptyState icon={FileTextIcon} title="Report not found" message="This report was deleted or is no longer available." actionLabel="Back" onAction={() => navigation.goBack()} />
        )}
      </View>
    );
  }

  const p = report.parameters;
  const s = report.summary;
  const isOwner = report.manager_id === profile.id;
  const size = formatBytes(s.size_bytes);
  const metrics = s.metrics ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title={formatCode('RPT', report.report_no)} subtitle={report.report_type} />
      <OfflineBanner />
      <Screen onRefresh={load} refreshing={loading}>
        <Card style={{ padding: 18 }}>
          <AppText size={11} color={colors.muted} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Conservation report
          </AppText>
          <AppText size={18} weight="semibold" lineHeight={24} style={{ marginTop: 6 }}>
            {report.title}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <StatusBadge status={report.format} size="sm" dot={false} />
            {p.is_combined ? <StatusBadge status="Combined" size="sm" dot={false} /> : null}
          </View>
          <Divider style={{ marginVertical: 14 }} />
          <KeyValue
            items={[
              { label: 'Analysis type', value: p.analysis_type ? ANALYSIS_TYPE_LABELS[p.analysis_type] : report.report_type },
              { label: p.is_combined ? 'Parks' : 'Park', value: reportParks(report, parkName) },
              { label: 'Location', value: p.is_combined ? 'All locations' : p.zone_name ?? (p.zone_id ? zoneName(p.zone_id) ?? '—' : 'All locations') },
              { label: 'Date range', value: p.date_from && p.date_to ? formatRange({ from: p.date_from, to: p.date_to }) : '—' },
              { label: 'Generated', value: formatDateTime(report.generated_at) },
              { label: 'Generated by', value: report.manager?.full_name || '—' },
              { label: 'Records', value: s.record_count !== undefined ? String(s.record_count) : '—' },
              { label: 'File', value: [report.format, s.pages ? `${s.pages} page${s.pages === 1 ? '' : 's'}` : null, size].filter(Boolean).join(' · ') },
            ]}
          />
        </Card>

        {metrics.length ? (
          <>
            <SectionHeader title="Summary metrics" style={{ marginTop: 20 }} />
            <View style={{ gap: 12 }}>
              {[metrics.slice(0, 2), metrics.slice(2, 4)].map((row, r) => (
                <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
                  {row.map((m) => (
                    <MetricCard key={m.label} label={m.label} value={m.value} sub={m.sub} tone={m.tone} />
                  ))}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {s.findings?.length ? (
          <>
            <SectionHeader title="Key findings" style={{ marginTop: 20 }} />
            <Card style={{ padding: 16, gap: 12 }}>
              {s.findings.map((f) => (
                <View key={f} style={{ flexDirection: 'row', gap: 10 }}>
                  <LightbulbIcon size={15} color={colors.forest500} style={{ marginTop: 2 }} />
                  <AppText size={13.5} lineHeight={19} style={{ flex: 1 }}>
                    {f}
                  </AppText>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {s.hotspots?.length ? (
          <>
            <SectionHeader title="Hotspots" style={{ marginTop: 20 }} />
            <Card>
              {s.hotspots.map((h, i) => (
                <View key={h.rank}>
                  {i > 0 ? <Divider /> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
                    <AppText size={13} weight="bold" color={colors.crit} style={{ width: 24 }}>
                      #{h.rank}
                    </AppText>
                    <View style={{ flex: 1 }}>
                      <AppText size={14} weight="medium">
                        Near {h.zone}
                      </AppText>
                      <AppText size={12} color={colors.muted}>
                        {h.park} · {formatCoord(h.latitude, h.longitude)}
                      </AppText>
                    </View>
                    <AppText size={15} weight="semibold">
                      {h.count}
                    </AppText>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {report.analysis_id ? (
          <Card style={{ marginTop: 20 }}>
            <ListRow
              icon={BarChart3Icon}
              title="View analysis results"
              subtitle="Charts, hotspots and breakdowns behind this report"
              onPress={() => navigation.navigate('AnalysisResults', { analysisId: report.analysis_id as string })}
            />
          </Card>
        ) : null}
      </Screen>
      <StickyFooter>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isOwner ? (
            <Button variant="outline" icon={Trash2Icon} onPress={() => setConfirmDelete(true)} style={{ flex: 1 }}>
              Delete
            </Button>
          ) : null}
          <Button icon={DownloadIcon} loading={downloading} disabled={!report.file_path} onPress={download} style={{ flex: 2 }}>
            Download PDF
          </Button>
        </View>
      </StickyFooter>
      <Modal
        open={confirmDelete}
        onClose={() => (deleting ? undefined : setConfirmDelete(false))}
        icon={Trash2Icon}
        tone="critical"
        title="Delete this report?"
        description={`${formatCode('RPT', report.report_no)} and its PDF file will be permanently removed from the reports library. The analysis results are kept.`}
        actions={
          <>
            <Button full variant="danger" loading={deleting} onPress={remove}>
              Delete report
            </Button>
            <Button full variant="ghost" disabled={deleting} onPress={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </View>
  );
}
