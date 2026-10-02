import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { CheckCircle2Icon, MapPinOffIcon, PercentIcon, RouteIcon, TargetIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BarList,
  BellButton,
  Card,
  ColumnChart,
  Divider,
  FilterChips,
  ListRow,
  MetricCard,
  OfflineBanner,
  Screen,
  SectionHeader,
} from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { colors } from '@shared/theme';
import { formatDate, formatKm } from '@shared/utils/format';
import type { Patrol } from '../models';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData } from '../hooks/useRemoteData';
import { useAutoReload } from '../hooks/useAutoReload';
import { patrolListCodec } from '../hooks/codecs';
import { COVERAGE_RANGES, rangeStart, type CoverageAnalysis, type CoverageRange } from '../services/coverage';
import { RemoteStatus } from '../components/RemoteStatus';
import { PatrolListRow } from '../components/PatrolItems';
import { useSupervisorNavigation } from '../navigation/types';

const RANGE_KEYS = COVERAGE_RANGES.map(String) as ('7' | '30' | '90')[];
const RANGE_LABELS = { '7': 'Last 7 days', '30': 'Last 30 days', '90': 'Last 90 days' };

export function CoverageScreen() {
  const navigation = useSupervisorNavigation();
  const supervisor = useSupervisor();
  const { zones, zoneName, parkName } = useLookups();
  const [range, setRange] = useState<CoverageRange>(30);

  const load = useCallback(() => supervisor.getFinishedPatrols(range), [supervisor, range]);
  const remote = useRemoteData(`sup:${supervisor.supervisorId}:coverage:${range}`, load, patrolListCodec);
  useAutoReload(remote.reload);

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title="Patrol coverage"
        subtitle={supervisor.parkId ? parkName(supervisor.parkId) : 'All parks'}
        hideBack
        right={<BellButton />}
      />
      <OfflineBanner />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <FilterChips
          options={RANGE_KEYS}
          value={String(range) as '7' | '30' | '90'}
          labels={RANGE_LABELS}
          onChange={(v) => setRange(Number(v) as CoverageRange)}
        />
      </View>
      <Screen onRefresh={remote.refresh} refreshing={remote.refreshing}>
        <RemoteStatus remote={remote} loadingLabel="Analysing patrol coverage…">
          {(finished) => (
            <CoverageBody
              finished={finished}
              range={range}
              analysis={supervisor.viewAnalysis(finished, zones, range, zoneName)}
              onOpenPatrol={(id) => navigation.navigate('PatrolDetail', { patrolId: id })}
              onAssignZone={(zoneId) => navigation.navigate('PatrolForm', { zoneId })}
            />
          )}
        </RemoteStatus>
      </Screen>
    </View>
  );
}

function CoverageBody({
  finished,
  range,
  analysis,
  onOpenPatrol,
  onAssignZone,
}: {
  finished: Patrol[];
  range: CoverageRange;
  analysis: CoverageAnalysis;
  onOpenPatrol: (id: string) => void;
  onAssignZone: (zoneId: string) => void;
}) {
  const zoneBars = useMemo(
    () => analysis.byZone.map((z) => ({ label: `${z.label} (${z.patrols})`, value: z.averageCoverage })),
    [analysis.byZone],
  );

  return (
    <>
      <AppText size={12} color={colors.muted} style={{ marginBottom: 12 }}>
        {formatDate(rangeStart(range))} – {formatDate(new Date())} · {finished.length} finished patrol{finished.length === 1 ? '' : 's'}
      </AppText>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <MetricCard label="Patrols completed" value={analysis.completed} icon={CheckCircle2Icon} tone="ok" sub={`${analysis.incomplete} incomplete`} />
        <MetricCard
          label="Completion rate"
          value={analysis.completionRate !== null ? `${analysis.completionRate}%` : '—'}
          icon={PercentIcon}
          tone={analysis.completionRate !== null && analysis.completionRate < 70 ? 'warn' : 'default'}
          sub="Completed of finished"
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <MetricCard
          label="Average coverage"
          value={analysis.averageCoverage !== null ? `${analysis.averageCoverage}%` : '—'}
          icon={TargetIcon}
          tone="info"
          sub="Of planned routes"
        />
        <MetricCard label="Distance patrolled" value={formatKm(analysis.totalKm)} icon={RouteIcon} sub="GPS track total" />
      </View>

      <View style={{ marginTop: 20 }}>
        <SectionHeader title="Patrols finished" />
        <Card style={{ padding: 16 }}>
          <ColumnChart data={analysis.trend} height={120} />
        </Card>
      </View>

      <View style={{ marginTop: 20 }}>
        <SectionHeader title="Average coverage by zone (%)" />
        <Card style={{ padding: 16 }}>
          {zoneBars.length ? (
            <BarList data={zoneBars} />
          ) : (
            <AppText size={13} color={colors.muted}>
              No finished patrols in this period.
            </AppText>
          )}
        </Card>
      </View>

      <View style={{ marginTop: 20 }}>
        <SectionHeader title={`Coverage gaps (${analysis.gaps.length})`} />
        <Card>
          {analysis.gaps.length ? (
            analysis.gaps.map((z, i) => (
              <View key={z.zone_id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  icon={MapPinOffIcon}
                  title={z.name}
                  subtitle="No completed patrol in this period · tap to assign one"
                  onPress={() => onAssignZone(z.zone_id)}
                />
              </View>
            ))
          ) : (
            <AppText size={13} color={colors.muted} style={{ padding: 16 }}>
              Every zone had at least one completed patrol in this period.
            </AppText>
          )}
        </Card>
      </View>

      <View style={{ marginTop: 20, marginBottom: 8 }}>
        <SectionHeader title={`Incomplete patrols (${analysis.incompletePatrols.length})`} />
        <Card>
          {analysis.incompletePatrols.length ? (
            analysis.incompletePatrols.map((p, i) => (
              <PatrolListRow key={p.patrolId} patrol={p} first={i === 0} onPress={() => onOpenPatrol(p.patrolId)} />
            ))
          ) : (
            <AppText size={13} color={colors.muted} style={{ padding: 16 }}>
              No patrol was stopped early in this period.
            </AppText>
          )}
        </Card>
      </View>
    </>
  );
}
