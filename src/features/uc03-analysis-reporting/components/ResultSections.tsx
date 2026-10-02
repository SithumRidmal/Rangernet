import React from 'react';
import { View } from 'react-native';
import {
  CheckCircle2Icon,
  CopyIcon,
  GaugeIcon,
  HandshakeIcon,
  LayersIcon,
  LightbulbIcon,
  MapIcon,
  MapPinIcon,
  RouteIcon,
  ShieldAlertIcon,
  TargetIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from 'lucide-react-native';
import {
  AppText,
  BarList,
  Card,
  ColumnChart,
  Divider,
  KeyValue,
  MetricCard,
  Notice,
  ProgressRing,
  SectionHeader,
  StatusBadge,
  TrendChart,
} from '@shared/components';
import { colors } from '@shared/theme';
import {
  ANALYSIS_TYPE_LABELS,
  type AnalysisResults,
  type AnalysisType,
  type ConflictAnalysis,
  type IncidentAnalysis,
  type KeyMetric,
  type ParkComparison,
  type PatrolCoverageAnalysis,
  type TrendBucket,
} from '../models/types';
import { formatMetric } from '../services/AnalysisEngine';
import { formatRange } from '../services/dates';
import { HotspotMapCard } from './HotspotMapCard';

export const ANALYSIS_TYPE_ICONS: Record<AnalysisType, LucideIcon> = {
  INCIDENT: ShieldAlertIcon,
  PATROL_COVERAGE: RouteIcon,
  CONFLICT: HandshakeIcon,
};

const METRIC_ICONS: Record<AnalysisType, LucideIcon[]> = {
  INCIDENT: [ShieldAlertIcon, MapIcon, MapPinIcon, CheckCircle2Icon],
  PATROL_COVERAGE: [RouteIcon, CheckCircle2Icon, TargetIcon, GaugeIcon],
  CONFLICT: [HandshakeIcon, TriangleAlertIcon, CheckCircle2Icon, CopyIcon],
};

const BUCKET_LABEL: Record<TrendBucket, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly' };

function Section({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <SectionHeader title={title} />
      <Card style={{ padding: 16 }}>
        {children}
        {caption ? (
          <AppText size={12} color={colors.muted} style={{ marginTop: 10 }}>
            {caption}
          </AppText>
        ) : null}
      </Card>
    </View>
  );
}

export function AnalysisHeaderCard({ results }: { results: AnalysisResults }) {
  const Icon = ANALYSIS_TYPE_ICONS[results.analysisType];
  return (
    <Card style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={colors.forest500} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText size={15} weight="semibold">
            {ANALYSIS_TYPE_LABELS[results.analysisType]}
          </AppText>
          <AppText size={12} color={colors.muted}>
            {results.recordCount} records analysed
          </AppText>
        </View>
        {results.isCombined ? <StatusBadge status="Combined" size="sm" /> : null}
      </View>
      <Divider style={{ marginVertical: 12 }} />
      <KeyValue
        items={[
          { label: results.isCombined ? 'Parks' : 'Park', value: results.parkNames.join(', ') },
          { label: 'Location', value: results.isCombined ? 'All locations' : results.zoneName ?? 'All locations' },
          { label: 'Date range', value: formatRange({ from: results.dateFrom, to: results.dateTo }) },
          { label: 'Mode', value: results.isCombined ? `Multiple parks (${results.parkIds.length})` : 'Single park' },
        ]}
      />
    </Card>
  );
}

export function MetricGrid({ metrics, type }: { metrics: KeyMetric[]; type: AnalysisType }) {
  const icons = METRIC_ICONS[type];
  const rows = [metrics.slice(0, 2), metrics.slice(2, 4)];
  return (
    <View style={{ gap: 12, marginTop: 16 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map((m, i) => (
            <MetricCard key={m.label} label={m.label} value={m.value} sub={m.sub} tone={m.tone} icon={icons[r * 2 + i]} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function FindingsCard({ findings }: { findings: string[] }) {
  if (!findings.length) return null;
  return (
    <View style={{ marginTop: 20 }}>
      <SectionHeader title="Key findings" />
      <Card style={{ padding: 16, gap: 12 }}>
        {findings.map((f) => (
          <View key={f} style={{ flexDirection: 'row', gap: 10 }}>
            <LightbulbIcon size={15} color={colors.forest500} style={{ marginTop: 2 }} />
            <AppText size={13.5} style={{ flex: 1 }} lineHeight={19}>
              {f}
            </AppText>
          </View>
        ))}
      </Card>
    </View>
  );
}

function TrendSection({ title, data, bucket, accent }: { title: string; data: { label: string; value: number }[]; bucket: TrendBucket; accent?: string }) {
  return (
    <Section title={title} caption={`${BUCKET_LABEL[bucket]} totals across the selected date range.`}>
      <TrendChart data={data} accent={accent} />
    </Section>
  );
}

export function IncidentSections({ s }: { s: IncidentAnalysis }) {
  return (
    <>
      <TrendSection title="Incident trend" data={s.trend} bucket={s.trendBucket} accent={colors.crit} />
      <HotspotMapCard title="Poaching hotspots" hotspots={s.hotspots} heat={s.heat} noun="incidents" />
      <Section title="Incidents by type">
        <BarList data={s.byType} />
      </Section>
      <Section title="Incidents by zone">
        <BarList data={s.byZone} accent={colors.warn} />
      </Section>
      <Section title="Incident status">
        <ColumnChart data={s.byStatus} />
      </Section>
      <Section title="Location capture" caption="Share of incident locations marked manually on the map instead of GPS.">
        <ProgressRing value={s.manualShare} label={`${s.manuallyMarked} of ${s.total} incident locations were marked manually`} />
      </Section>
    </>
  );
}

export function PatrolSections({ s }: { s: PatrolCoverageAnalysis }) {
  const zonesWithCoverage = s.coverageByZone.filter((z) => z.avgCoverage !== null);
  return (
    <>
      <Section title="Completion & coverage">
        <View style={{ gap: 14 }}>
          <ProgressRing value={s.completionRate} label={`${s.completed} of ${s.total} patrols completed in the range`} />
          <ProgressRing value={s.avgCoverage ?? 0} label={s.avgCoverage === null ? 'No coverage recorded for finished patrols' : 'Average route coverage of finished patrols'} />
        </View>
        <Divider style={{ marginVertical: 14 }} />
        <KeyValue
          items={[
            { label: 'Distance covered', value: `${s.totalDistanceKm.toFixed(1)} km` },
            { label: 'Planned distance', value: `${s.plannedDistanceKm.toFixed(1)} km` },
            { label: 'In progress', value: String(s.inProgress) },
            { label: 'Incomplete', value: String(s.incomplete) },
          ]}
        />
      </Section>
      <View style={{ marginTop: 20 }}>
        <SectionHeader title={`Coverage gaps (${s.gaps.length})`} />
        {s.gaps.length === 0 ? (
          <Notice tone="ok" icon={CheckCircle2Icon} message="Every zone in the selection had a completed patrol with at least 50% average coverage." />
        ) : (
          <Card>
            {s.gaps.map((g, i) => (
              <View key={g.zoneId}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: g.reason === 'NO_COMPLETED_PATROL' ? colors.critBg : colors.warnBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TriangleAlertIcon size={16} color={g.reason === 'NO_COMPLETED_PATROL' ? colors.crit : colors.warn} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText size={14} weight="medium">
                      {g.zoneName}
                    </AppText>
                    <AppText size={12} color={colors.muted}>
                      {g.parkName} · {g.reason === 'NO_COMPLETED_PATROL' ? 'No completed patrol in range' : `Average coverage ${g.avgCoverage}%`}
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}
      </View>
      <Section title="Average coverage by zone" caption="Zones without finished patrols are listed as coverage gaps.">
        {zonesWithCoverage.length ? (
          <BarList data={zonesWithCoverage.map((z) => ({ label: `${z.zoneName} (${z.completed}/${z.total})`, value: z.avgCoverage ?? 0 }))} />
        ) : (
          <AppText size={13} color={colors.muted}>
            No coverage has been recorded for finished patrols yet.
          </AppText>
        )}
      </Section>
      <TrendSection title="Patrols over time" data={s.trend} bucket={s.trendBucket} />
      <Section title="Patrols by status">
        <ColumnChart data={s.byStatus} />
      </Section>
    </>
  );
}

export function ConflictSections({ s }: { s: ConflictAnalysis }) {
  return (
    <>
      <TrendSection title="Conflict trend" data={s.trend} bucket={s.trendBucket} accent={colors.warn} />
      <HotspotMapCard title="Conflict hotspots" hotspots={s.hotspots} heat={s.heat} noun="reports" />
      <Section title="Reports by conflict type">
        <BarList data={s.byType} />
      </Section>
      <Section title="Severity">
        <ColumnChart data={s.bySeverity} highlightMax />
      </Section>
      <Section title="Report channel & response">
        <KeyValue
          items={[
            { label: 'App reports', value: String(s.appCount) },
            { label: 'SMS reports', value: String(s.smsCount) },
            { label: 'Ranger response', value: String(s.withResponse) },
            {
              label: 'Avg. time to resolve',
              value: s.avgResolutionHours === null ? '—' : s.avgResolutionHours < 24 ? `${s.avgResolutionHours} h` : `${(s.avgResolutionHours / 24).toFixed(1)} days`,
            },
          ]}
        />
      </Section>
      <Section title="Reports by zone">
        <BarList data={s.byZone} accent={colors.warn} />
      </Section>
      <Section title="Report status">
        <BarList data={s.byStatus.filter((d) => d.value > 0)} accent={colors.forest700} />
      </Section>
    </>
  );
}

export function ComparisonSection({ comparison }: { comparison: ParkComparison[] }) {
  if (!comparison.length) return null;
  const primaryLabel = comparison[0].primary.label;
  return (
    <View style={{ marginTop: 20 }}>
      <SectionHeader title="Per-park comparison" />
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <LayersIcon size={15} color={colors.forest500} />
          <AppText size={13} weight="medium">
            {primaryLabel} by park
          </AppText>
        </View>
        <BarList data={comparison.map((p) => ({ label: p.parkName, value: p.primary.value }))} />
      </Card>
      <View style={{ gap: 12, marginTop: 12 }}>
        {comparison.map((p) => (
          <Card key={p.parkId} style={{ padding: 14 }}>
            <AppText size={14} weight="semibold" style={{ marginBottom: 10 }}>
              {p.parkName}
            </AppText>
            <KeyValue items={p.metrics.map((m) => ({ label: m.label, value: formatMetric(m) }))} />
          </Card>
        ))}
      </View>
    </View>
  );
}
