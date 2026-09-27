import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DatabaseIcon, FileTextIcon, SearchXIcon } from 'lucide-react-native';
import { AppBar, AppText, BellButton, Button, EmptyState, LoadingBlock, OfflineBanner, Screen, StickyFooter } from '@shared/components';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { formatDateTime } from '@shared/utils/format';
import { StateView } from '../components/StateView';
import {
  AnalysisHeaderCard,
  ComparisonSection,
  ConflictSections,
  FindingsCard,
  IncidentSections,
  MetricGrid,
  PatrolSections,
} from '../components/ResultSections';
import { ANALYSIS_TYPE_LABELS, type AnalysisResults } from '../models/types';
import type { ParkManagerStackParamList } from '../navigation/types';
import { analysisController } from '../services/AnalysisController';
import { analysisEngine } from '../services/AnalysisEngine';
import { formatRange } from '../services/dates';

type Props = NativeStackScreenProps<ParkManagerStackParamList, 'AnalysisResults'>;

/** UC-03 step 5: results with statistics, charts, hotspots / coverage gaps and per-park comparison. */
export function AnalysisResultsScreen({ navigation, route }: Props) {
  const { analysisId } = route.params;
  const { online } = useSync();
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const settle = useCallback(
    (task: Promise<AnalysisResults | null>) =>
      task
        .then(setResults)
        .catch((e: unknown) => setError(getErrorMessage(e)))
        .finally(() => setLoading(false)),
    [],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    return settle(analysisController.getAnalysisResults(analysisId));
  }, [analysisId, settle]);

  useEffect(() => {
    settle(analysisController.getAnalysisResults(analysisId));
  }, [analysisId, settle]);

  const metrics = useMemo(() => (results ? analysisEngine.keyMetrics(results.summary) : []), [results]);
  const findings = useMemo(() => (results ? analysisEngine.findings(results) : []), [results]);

  if (error) {
    return (
      <StateView
        appBarTitle="Analysis results"
        icon={DatabaseIcon}
        tone="critical"
        title="Results could not be loaded"
        message={online ? error : 'You are offline. Connect to the park server to load these results.'}
        primaryLabel="Retry"
        onPrimary={load}
      />
    );
  }

  if (loading || !results) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Analysis results" />
        <OfflineBanner />
        {loading ? (
          <LoadingBlock label="Loading results…" />
        ) : (
          <EmptyState
            icon={SearchXIcon}
            title="Analysis not found"
            message="These analysis results are no longer available. Run the analysis again."
            actionLabel="New analysis"
            onAction={() => navigation.navigate('Tabs', { screen: 'Analysis' })}
          />
        )}
      </View>
    );
  }

  const s = results.summary;
  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title={`${ANALYSIS_TYPE_LABELS[results.analysisType].replace(' Analysis', '')} results`}
        subtitle={`${formatRange({ from: results.dateFrom, to: results.dateTo })} · ${results.recordCount} records`}
        right={<BellButton />}
      />
      <OfflineBanner />
      <Screen>
        <AnalysisHeaderCard results={results} />
        <MetricGrid metrics={metrics} type={results.analysisType} />
        <FindingsCard findings={findings} />
        {s.kind === 'INCIDENT' ? <IncidentSections s={s} /> : null}
        {s.kind === 'PATROL_COVERAGE' ? <PatrolSections s={s} /> : null}
        {s.kind === 'CONFLICT' ? <ConflictSections s={s} /> : null}
        {results.comparison ? <ComparisonSection comparison={results.comparison} /> : null}
        <AppText size={11} color={colors.muted} align="center" style={{ marginTop: 20, marginBottom: 8 }}>
          Analysed {formatDateTime(results.analysedAt)}
        </AppText>
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={FileTextIcon} onPress={() => navigation.navigate('ReportGenerate', { analysisId: results.analysisId })}>
          Generate Report
        </Button>
      </StickyFooter>
    </View>
  );
}