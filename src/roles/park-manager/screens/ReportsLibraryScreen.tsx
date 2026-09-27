import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CloudOffIcon, DatabaseIcon, FileTextIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BellButton,
  EmptyState,
  FilterChips,
  OfflineBanner,
  ReportCard,
  Screen,
  Skeleton,
  useToast,
} from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { ANALYSIS_TYPES, type AnalysisType, type ReportRecord } from '../models/types';
import { useParkManager } from '../hooks/useParkManager';
import { useParkManagerNavigation } from '../navigation/types';
import { reportService } from '../services/ReportService';
import { reportMeta } from './reportFormat';

type TypeFilter = 'ALL' | AnalysisType;
const FILTERS: readonly TypeFilter[] = ['ALL', ...ANALYSIS_TYPES];
const FILTER_LABELS: Record<TypeFilter, string> = {
  ALL: 'All',
  INCIDENT: 'Incidents',
  PATROL_COVERAGE: 'Patrol coverage',
  CONFLICT: 'Conflicts',
};

/** Reports library: generated conservation reports with download. */
export function ReportsLibraryScreen() {
  const navigation = useParkManagerNavigation();
  const manager = useParkManager();
  const { parkName } = useLookups();
  const { online } = useSync();
  const toast = useToast();
  const [reports, setReports] = useState<ReportRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TypeFilter>('ALL');
  const downloading = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await manager.reports());
    } catch (e) {
      setError(getErrorMessage(e, 'The reports could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [manager]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const download = async (r: ReportRecord) => {
    if (downloading.current) return;
    downloading.current = r.report_id;
    toast.show('Preparing PDF…');
    try {
      await reportService.downloadReport(r.report_id);
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
    } finally {
      downloading.current = null;
    }
  };

  const list = (reports ?? []).filter((r) => filter === 'ALL' || r.parameters.analysis_type === filter);

  const content = () => {
    if (!reports && loading) {
      return (
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 78, borderRadius: 12 }} />
          ))}
        </View>
      );
    }
    if (error && !reports) {
      return (
        <EmptyState
          icon={online ? DatabaseIcon : CloudOffIcon}
          tone="critical"
          title={online ? 'Reports could not be loaded' : 'You are offline'}
          message={online ? error : 'The reports library needs a connection to the park server.'}
          actionLabel="Retry"
          onAction={load}
        />
      );
    }
    if (list.length === 0) {
      return (
        <EmptyState
          icon={FileTextIcon}
          title={reports?.length ? 'No reports of this type' : 'No reports yet'}
          message={
            reports?.length
              ? 'Choose another type or generate a new report from an analysis.'
              : 'Run a data analysis and tap Generate Report to save a PDF report here.'
          }
          actionLabel="Run an analysis"
          onAction={() => navigation.navigate('Tabs', { screen: 'Analysis' })}
        />
      );
    }
    return (
      <View style={{ gap: 12 }}>
        {error ? (
          <AppText size={12} color={colors.crit}>
            {error}
          </AppText>
        ) : null}
        {list.map((r) => (
          <ReportCard
            key={r.report_id}
            title={r.title}
            type={`${r.report_type}${r.parameters.is_combined ? ' · Combined' : ''}`}
            meta={reportMeta(r, parkName)}
            onPress={() => navigation.navigate('ReportDetail', { reportId: r.report_id })}
            onDownload={r.file_path ? () => download(r) : undefined}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Reports" subtitle={reports ? `${reports.length} generated report${reports.length === 1 ? '' : 's'}` : 'Conservation reports'} hideBack right={<BellButton />} />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12 }}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} labels={FILTER_LABELS} />
      </View>
      <OfflineBanner />
      <Screen onRefresh={load} refreshing={loading && !!reports}>
        {content()}
      </Screen>
    </View>
  );
}
