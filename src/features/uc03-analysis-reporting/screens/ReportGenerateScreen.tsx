import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FileCheckIcon, TriangleAlertIcon } from 'lucide-react-native';
import { AppBar, AppText, Screen, SuccessScreen, useToast } from '@shared/components';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { formatCode, formatDateTime, formatTime } from '@shared/utils/format';
import { StateView } from '../components/StateView';
import { useParkManager } from '../hooks/useParkManager';
import type { ParkManagerStackParamList } from '../navigation/types';
import { analysisController } from '../services/AnalysisController';
import { reportService, type GeneratedReport } from '../services/ReportService';
import { formatBytes } from './reportFormat';

type Props = NativeStackScreenProps<ParkManagerStackParamList, 'ReportGenerate'>;

type State =
  | { kind: 'generating' }
  | { kind: 'generated'; report: GeneratedReport }
  | { kind: 'failed'; message: string; at: string };

/** UC-03 steps 6–7: generate the PDF conservation report, then view / download it (with Report Generation Failure). */
export function ReportGenerateScreen({ navigation, route }: Props) {
  const { analysisId } = route.params;
  const manager = useParkManager();
  const { online } = useSync();
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: 'generating' });
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!onlineRef.current) throw new Error('You are offline. The report is saved to the park server, so a connection is required.');
      const results = await analysisController.getAnalysisResults(analysisId);
      if (!results) throw new Error('The analysis results are no longer available. Run the analysis again.');
      return manager.requestReport(results);
    })()
      .then((report) => alive && setState({ kind: 'generated', report }))
      .catch((e: unknown) => alive && setState({ kind: 'failed', message: getErrorMessage(e), at: new Date().toISOString() }));
    return () => {
      alive = false;
    };
  }, [analysisId, attempt, manager]);

  const download = async (reportId: string) => {
    if (downloading) return;
    setDownloading(true);
    toast.show('Preparing PDF…');
    try {
      await reportService.downloadReport(reportId);
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
    } finally {
      setDownloading(false);
    }
  };

  if (state.kind === 'failed') {
    return (
      <StateView
        appBarTitle="Report generation failed"
        icon={TriangleAlertIcon}
        tone="critical"
        title="Report could not be generated"
        message={state.message}
        reassurance="Your analysis results are unchanged and remain available. No report was saved."
        meta={[
          { label: 'Attempted', value: formatTime(state.at) },
          { label: 'Format', value: 'PDF' },
        ]}
        primaryLabel="Retry"
        onPrimary={() => {
          setState({ kind: 'generating' });
          setAttempt((a) => a + 1);
        }}
        secondaryLabel="Back to results"
        onSecondary={() => navigation.goBack()}
      />
    );
  }

  if (state.kind === 'generated') {
    const { record, numberOfPages, sizeBytes } = state.report;
    const size = formatBytes(sizeBytes);
    return (
      <SuccessScreen
        icon={FileCheckIcon}
        title="Report generated"
        message={`${record.title} has been saved to the reports library.`}
        meta={[
          { label: 'Report ID', value: formatCode('RPT', record.report_no) },
          { label: 'Type', value: record.report_type },
          { label: 'Format', value: size ? `PDF · ${size}` : 'PDF' },
          { label: 'Pages', value: String(numberOfPages) },
          { label: 'Generated', value: formatDateTime(record.generated_at) },
        ]}
        primaryLabel={downloading ? 'Preparing PDF…' : 'View / Download PDF'}
        onPrimary={() => download(record.report_id)}
        secondaryLabel="Back to results"
        onSecondary={() => navigation.goBack()}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar title="Generate report" subtitle="PDF conservation report" />
      <Screen bg={colors.white} contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.forest500} />
        <AppText size={18} weight="semibold" align="center" style={{ marginTop: 24 }}>
          Generating report…
        </AppText>
        <AppText size={13.5} color={colors.muted} align="center" lineHeight={20} style={{ marginTop: 8, maxWidth: 280 }}>
          Building the conservation report, rendering the PDF and saving it to the reports library.
        </AppText>
      </Screen>
    </View>
  );
}
