import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckIcon, DatabaseIcon, SearchXIcon, ServerCrashIcon, SlidersHorizontalIcon } from 'lucide-react-native';
import { AppBar, AppText, Card, EmptyState, OfflineBanner, Screen } from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { colors, radius } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { StateView } from '../components/StateView';
import { DataRetrievalError } from '../models/DataRepository';
import { ANALYSIS_TYPE_LABELS } from '../models/types';
import { useParkManager } from '../hooks/useParkManager';
import type { ParkManagerStackParamList } from '../navigation/types';
import { ANALYSIS_STEPS, FilterValidationError, NoDataError, type AnalysisStep } from '../services/AnalysisController';
import { formatRange } from '../services/dates';

type Props = NativeStackScreenProps<ParkManagerStackParamList, 'Analyzing'>;

type Outcome =
  | { kind: 'running' }
  | { kind: 'nodata'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'error'; retrieval: boolean; message: string };

/** UC-03 step 4: validate filters, retrieve and analyse the data (with No Data / failure exceptions). */
export function AnalyzingScreen({ navigation, route }: Props) {
  const { request } = route.params;
  const manager = useParkManager();
  const lookups = useLookups();
  const { online } = useSync();
  const [step, setStep] = useState<AnalysisStep>('validate');
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'running' });
  const [attempt, setAttempt] = useState(0);
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  });

  const { parks, zones, incidentTypes, conflictTypes, loading: lookupsLoading } = lookups;

  useEffect(() => {
    if (lookupsLoading) return;
    let alive = true;
    manager
      .viewAnalysis(request.type, request.location, request.dateRange, {
        lookups: { parks, zones, incidentTypes, conflictTypes },
        online: onlineRef.current,
        onStep: (s) => alive && setStep(s),
      })
      .then((results) => {
        if (alive) navigation.replace('AnalysisResults', { analysisId: results.analysisId });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof NoDataError) setOutcome({ kind: 'nodata', message: e.message });
        else if (e instanceof FilterValidationError) setOutcome({ kind: 'invalid', message: e.message });
        else setOutcome({ kind: 'error', retrieval: e instanceof DataRetrievalError, message: getErrorMessage(e) });
      });
    return () => {
      alive = false;
    };
  }, [attempt, lookupsLoading, manager, navigation, request, parks, zones, incidentTypes, conflictTypes]);

  const retry = useCallback(() => {
    setOutcome({ kind: 'running' });
    setStep('validate');
    setAttempt((a) => a + 1);
  }, []);
  const changeFilters = useCallback(() => navigation.goBack(), [navigation]);

  const typeLabel = ANALYSIS_TYPE_LABELS[request.type];
  const parkLabel =
    request.location.parkIds.length > 1
      ? `${request.location.parkIds.length} parks`
      : parks.find((p) => p.park_id === request.location.parkIds[0])?.name ?? 'Selected park';
  const context = `${parkLabel} · ${formatRange(request.dateRange)}`;

  if (outcome.kind === 'nodata') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        <AppBar title="No data found" subtitle={typeLabel} />
        <Screen bg={colors.white} contentStyle={{ justifyContent: 'center' }}>
          <EmptyState icon={SearchXIcon} title="No data for these filters" message={`${outcome.message} Change the filters and try again.`} actionLabel="Change filters" onAction={changeFilters} />
        </Screen>
      </View>
    );
  }

  if (outcome.kind === 'invalid') {
    return (
      <StateView
        appBarTitle="Check the filters"
        icon={SlidersHorizontalIcon}
        title="The filters are not valid"
        message={outcome.message}
        primaryLabel="Change filters"
        primaryIcon={SlidersHorizontalIcon}
        onPrimary={changeFilters}
      />
    );
  }

  if (outcome.kind === 'error') {
    return (
      <StateView
        appBarTitle={outcome.retrieval ? 'Data retrieval failed' : 'Analysis failed'}
        appBarSubtitle={typeLabel}
        icon={outcome.retrieval ? DatabaseIcon : ServerCrashIcon}
        tone="critical"
        title={outcome.retrieval ? 'Could not retrieve the data' : 'Analysis could not complete'}
        message={outcome.message}
        reassurance="No report was generated and no data was changed. Your filters are kept so you can try again."
        meta={[
          { label: 'Analysis', value: typeLabel },
          { label: 'Scope', value: context },
        ]}
        primaryLabel="Retry"
        onPrimary={retry}
        secondaryLabel="Change filters"
        onSecondary={changeFilters}
      />
    );
  }

  const activeIndex = ANALYSIS_STEPS.findIndex((s) => s.key === step);
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar title="Running analysis" subtitle={`Step 3 of 3 · ${typeLabel}`} />
      <OfflineBanner />
      <Screen bg={colors.white}>
        <Card style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={colors.forest500} />
            <View style={{ flex: 1 }}>
              <AppText size={15} weight="semibold">
                {typeLabel}
              </AppText>
              <AppText size={12.5} color={colors.muted}>
                {context}
              </AppText>
            </View>
          </View>
          <View style={{ marginTop: 20, gap: 14 }}>
            {ANALYSIS_STEPS.map((s, i) => {
              const done = i < activeIndex;
              const current = i === activeIndex;
              return (
                <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: done ? colors.ok : current ? colors.forest500 : colors.line,
                      backgroundColor: done ? colors.ok : colors.white,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? <CheckIcon size={12} color={colors.white} strokeWidth={3} /> : current ? <ActivityIndicator size="small" color={colors.forest500} style={{ transform: [{ scale: 0.6 }] }} /> : null}
                  </View>
                  <AppText size={13.5} color={i <= activeIndex ? colors.ink : colors.muted} weight={current ? 'medium' : 'regular'}>
                    {s.label}
                    {current ? '…' : ''}
                  </AppText>
                </View>
              );
            })}
          </View>
          <View style={{ marginTop: 20, height: 6, borderRadius: radius.full, backgroundColor: colors.forest100, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: `${Math.min(((activeIndex + 0.5) / ANALYSIS_STEPS.length) * 100, 100)}%`,
                borderRadius: radius.full,
                backgroundColor: colors.forest500,
              }}
            />
          </View>
        </Card>
        <AppText size={12.5} color={colors.muted} align="center" style={{ marginTop: 16 }}>
          {lookupsLoading ? 'Loading park and zone reference data…' : 'Results are stored in the analysis history when complete.'}
        </AppText>
      </Screen>
    </View>
  );
}
