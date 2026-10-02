import type {
  AnalysisContext,
  AnalysisResults,
  AnalysisSummary,
  AnalysisType,
  CommunityReport,
  ComparisonMetric,
  ConflictAnalysis,
  CoverageGap,
  Datum,
  HeatCell,
  Hotspot,
  Incident,
  IncidentAnalysis,
  KeyMetric,
  MultiParkData,
  ParkComparison,
  Patrol,
  PatrolCoverageAnalysis,
  TrendBucket,
  ZoneCoverage,
} from '../models/types';
import { addDays, daysBetween, monthLabel, parseLocalDate, shortDayLabel, startOfDay } from './dates';

/** Grid cell size used to cluster coordinates into hotspots (~1.1 km at the equator). */
export const HOTSPOT_CELL_DEG = 0.01;
const TOP_HOTSPOTS = 5;
const MAX_HEAT_CELLS = 40;
const LOW_COVERAGE_THRESHOLD = 50;

type GeoPoint = { latitude: number; longitude: number };

const round = (n: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const pct = (part: number, whole: number) => (whole > 0 ? round((part / whole) * 100) : 0);

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function average(values: number[]): number | null {
  return values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

function countBy<T>(items: T[], labelOf: (item: T) => string, fixedOrder?: string[]): Datum[] {
  const counts = new Map<string, number>();
  fixedOrder?.forEach((l) => counts.set(l, 0));
  items.forEach((it) => {
    const l = labelOf(it);
    counts.set(l, (counts.get(l) ?? 0) + 1);
  });
  const data = Array.from(counts, ([label, value]) => ({ label, value }));
  return fixedOrder ? data : data.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function hasCoords<T extends { latitude: number | null; longitude: number | null }>(l: T | null): l is T & GeoPoint {
  return !!l && typeof l.latitude === 'number' && typeof l.longitude === 'number';
}

/**
 * AnalysisEngine (sequence diagram participant). Pure functions only – no I/O –
 * so the statistics, trends, hotspots and coverage gaps are testable in isolation.
 */
export class AnalysisEngine {
  /* ----------------------------- shared helpers ----------------------------- */

  zoneLabel(ctx: AnalysisContext, zoneId: string | null): string {
    return ctx.zones.find((z) => z.zone_id === zoneId)?.name ?? 'Unassigned zone';
  }

  parkLabel(ctx: AnalysisContext, parkId: string | null): string {
    return ctx.parks.find((p) => p.park_id === parkId)?.name ?? 'Unknown park';
  }

  /** Trend over the selected range: daily up to 31 days, weekly up to ~6 months, otherwise monthly. */
  buildTrend(timestamps: (string | null)[], ctx: AnalysisContext): { trend: Datum[]; bucket: TrendBucket } {
    const from = parseLocalDate(ctx.dateRange.from);
    const to = parseLocalDate(ctx.dateRange.to);
    if (!from || !to || to < from) return { trend: [], bucket: 'day' };
    const days = daysBetween(from, to) + 1;
    const bucket: TrendBucket = days <= 31 ? 'day' : days <= 183 ? 'week' : 'month';
    const starts: Date[] = [];
    if (bucket === 'month') {
      for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d <= to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        starts.push(d);
      }
    } else {
      const step = bucket === 'day' ? 1 : 7;
      for (let d = from; d <= to; d = addDays(d, step)) starts.push(d);
    }
    const counts = starts.map(() => 0);
    timestamps.forEach((ts) => {
      if (!ts) return;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return;
      let idx: number;
      if (bucket === 'month') idx = (d.getFullYear() - from.getFullYear()) * 12 + d.getMonth() - from.getMonth();
      else idx = Math.floor(daysBetween(from, startOfDay(d)) / (bucket === 'day' ? 1 : 7));
      if (idx >= 0 && idx < counts.length) counts[idx] += 1;
    });
    const multiYear = from.getFullYear() !== to.getFullYear();
    const trend = starts.map((s, i) => ({
      label: bucket === 'month' ? monthLabel(s, multiYear) : shortDayLabel(s),
      value: counts[i],
    }));
    return { trend, bucket };
  }

  nearestZone(ctx: AnalysisContext, p: GeoPoint): { zoneName: string; parkName: string } {
    const candidates = ctx.zones.filter((z) => ctx.parkIds.includes(z.park_id));
    const pool = candidates.length ? candidates : ctx.zones;
    let best: { zoneName: string; parkName: string; d: number } | null = null;
    for (const z of pool) {
      const d = haversineKm(p, { latitude: z.center_lat, longitude: z.center_lng });
      if (!best || d < best.d) best = { zoneName: z.name, parkName: this.parkLabel(ctx, z.park_id), d };
    }
    return best ? { zoneName: best.zoneName, parkName: best.parkName } : { zoneName: 'Outside mapped zones', parkName: '—' };
  }

  /** Grid clustering of coordinates into ~0.01° cells; returns the top cells as ranked hotspots plus heat cells. */
  identifyHotspots(points: GeoPoint[], ctx: AnalysisContext): { hotspots: Hotspot[]; heat: HeatCell[] } {
    const cells = new Map<string, { i: number; j: number; count: number }>();
    points.forEach((p) => {
      const i = Math.floor(p.latitude / HOTSPOT_CELL_DEG);
      const j = Math.floor(p.longitude / HOTSPOT_CELL_DEG);
      const key = `${i}:${j}`;
      const c = cells.get(key);
      if (c) c.count += 1;
      else cells.set(key, { i, j, count: 1 });
    });
    const sorted = Array.from(cells.values()).sort((a, b) => b.count - a.count || a.i - b.i || a.j - b.j);
    const max = sorted[0]?.count ?? 1;
    const centre = (c: { i: number; j: number }) => ({
      latitude: round((c.i + 0.5) * HOTSPOT_CELL_DEG, 5),
      longitude: round((c.j + 0.5) * HOTSPOT_CELL_DEG, 5),
    });
    const heat = sorted.slice(0, MAX_HEAT_CELLS).map((c) => ({
      id: `${c.i}:${c.j}`,
      ...centre(c),
      count: c.count,
      intensity: round(c.count / max, 2),
    }));
    const hotspots = sorted.slice(0, TOP_HOTSPOTS).map((c, idx) => {
      const pos = centre(c);
      return {
        rank: idx + 1,
        ...pos,
        count: c.count,
        share: pct(c.count, points.length),
        intensity: round(c.count / max, 2),
        ...this.nearestZone(ctx, pos),
      };
    });
    return { hotspots, heat };
  }

  /* ------------------------------ UC-03 incidents ----------------------------- */

  analyzeIncidentTrendsAndHotspots(incidents: Incident[], ctx: AnalysisContext): IncidentAnalysis {
    return this.calculateStatisticsTrendsAndHotspots(incidents, ctx);
  }

  calculateStatisticsTrendsAndHotspots(incidents: Incident[], ctx: AnalysisContext): IncidentAnalysis {
    const typeName = (i: Incident) =>
      i.type?.type_name ?? ctx.incidentTypes.find((t) => t.type_id === i.type_id)?.type_name ?? 'Other';
    const located = incidents.map((i) => i.location).filter(hasCoords);
    const manuallyMarked = incidents.filter((i) => i.location?.manually_marked).length;
    const { trend, bucket } = this.buildTrend(incidents.map((i) => i.reported_at), ctx);
    const { hotspots, heat } = this.identifyHotspots(located, ctx);
    return {
      kind: 'INCIDENT',
      total: incidents.length,
      byType: countBy(incidents, typeName),
      byZone: countBy(incidents, (i) => this.zoneLabel(ctx, i.zone_id)),
      byStatus: countBy(incidents, (i) => i.status, ['Reported', 'Under Review', 'Resolved']),
      trend,
      trendBucket: bucket,
      withCoordinates: located.length,
      manuallyMarked,
      manualShare: pct(manuallyMarked, incidents.length),
      resolved: incidents.filter((i) => i.status === 'Resolved').length,
      hotspots,
      heat,
    };
  }

  /* ---------------------------- UC-03 patrol coverage -------------------------- */

  analyzePatrolCoverageAndIdentifyGaps(patrols: Patrol[], ctx: AnalysisContext): PatrolCoverageAnalysis {
    const by = (s: Patrol['status']) => patrols.filter((p) => p.status === s).length;
    const completed = by('Completed');
    const finished = patrols.filter((p) => p.status === 'Completed' || p.status === 'Incomplete');
    const coverageOf = (list: Patrol[]) =>
      average(list.map((p) => num(p.route?.coverage_percent)).filter((v): v is number => v !== null));
    const { trend, bucket } = this.buildTrend(patrols.map((p) => p.start_time ?? p.scheduled_for), ctx);

    const zonesInScope = ctx.zones.filter(
      (z) => ctx.parkIds.includes(z.park_id) && (!ctx.zoneId || z.zone_id === ctx.zoneId),
    );
    const coverageByZone: ZoneCoverage[] = zonesInScope.map((z) => {
      const inZone = patrols.filter((p) => p.zone_id === z.zone_id);
      const done = inZone.filter((p) => p.status === 'Completed' || p.status === 'Incomplete');
      return {
        zoneId: z.zone_id,
        zoneName: z.name,
        parkName: this.parkLabel(ctx, z.park_id),
        total: inZone.length,
        completed: inZone.filter((p) => p.status === 'Completed').length,
        avgCoverage: coverageOf(done),
      };
    });
    const unzoned = patrols.filter((p) => !p.zone_id);
    if (unzoned.length) {
      coverageByZone.push({
        zoneId: 'unassigned',
        zoneName: 'Unassigned zone',
        parkName: '—',
        total: unzoned.length,
        completed: unzoned.filter((p) => p.status === 'Completed').length,
        avgCoverage: coverageOf(unzoned.filter((p) => p.status === 'Completed' || p.status === 'Incomplete')),
      });
    }
    coverageByZone.sort((a, b) => (b.avgCoverage ?? -1) - (a.avgCoverage ?? -1) || b.total - a.total);

    const gaps: CoverageGap[] = coverageByZone
      .filter((z) => z.zoneId !== 'unassigned')
      .flatMap((z): CoverageGap[] => {
        if (z.completed === 0) return [{ ...z, reason: 'NO_COMPLETED_PATROL' }];
        if (z.avgCoverage !== null && z.avgCoverage < LOW_COVERAGE_THRESHOLD) return [{ ...z, reason: 'LOW_COVERAGE' }];
        return [];
      })
      .map(({ zoneId, zoneName, parkName, completed: c, avgCoverage, reason }) => ({
        zoneId,
        zoneName,
        parkName,
        completed: c,
        avgCoverage,
        reason,
      }));

    return {
      kind: 'PATROL_COVERAGE',
      total: patrols.length,
      assigned: by('Assigned'),
      inProgress: by('In Progress'),
      completed,
      incomplete: by('Incomplete'),
      completionRate: pct(completed, patrols.length),
      avgCoverage: coverageOf(finished),
      totalDistanceKm: round(patrols.reduce((s, p) => s + (num(p.route?.distance_covered) ?? 0), 0), 2),
      plannedDistanceKm: round(patrols.reduce((s, p) => s + (num(p.route?.planned_distance_km) ?? 0), 0), 2),
      byStatus: countBy(patrols, (p) => p.status, ['Assigned', 'In Progress', 'Completed', 'Incomplete']),
      trend,
      trendBucket: bucket,
      coverageByZone,
      gaps,
    };
  }

  /* -------------------------- UC-03 human-wildlife conflict -------------------- */

  analyzeConflictPatternsAndHotspots(reports: CommunityReport[], ctx: AnalysisContext): ConflictAnalysis {
    const typeName = (r: CommunityReport) =>
      r.type?.type_name ?? ctx.conflictTypes.find((t) => t.type_id === r.type_id)?.type_name ?? 'Other';
    const resolved = reports.filter((r) => r.status === 'Resolved' || r.status === 'Closed').length;
    const withResponse = reports.filter((r) => r.assignment).length;
    const resolutionHours = reports
      .map((r) => r.assignment)
      .filter((a): a is NonNullable<typeof a> => !!a && !!a.assigned_at && !!a.resolved_at)
      .map((a) => (new Date(a.resolved_at as string).getTime() - new Date(a.assigned_at as string).getTime()) / 3_600_000)
      .filter((h) => Number.isFinite(h) && h >= 0);
    const { trend, bucket } = this.buildTrend(reports.map((r) => r.reported_at), ctx);
    const { hotspots, heat } = this.identifyHotspots(reports.map((r) => r.location).filter(hasCoords), ctx);
    return {
      kind: 'CONFLICT',
      total: reports.length,
      byType: countBy(reports, typeName),
      bySeverity: countBy(reports, (r) => r.severity ?? 'Not assessed', ['Low', 'Medium', 'High', 'Critical', 'Not assessed']),
      byZone: countBy(reports, (r) => this.zoneLabel(ctx, r.zone_id)),
      byStatus: countBy(reports, (r) => r.status, ['Reported', 'Under Review', 'Responding', 'Resolved', 'Closed', 'Duplicate']),
      trend,
      trendBucket: bucket,
      highRisk: reports.filter((r) => r.is_high_risk).length,
      appCount: reports.filter((r) => r.report_channel === 'APP').length,
      smsCount: reports.filter((r) => r.report_channel === 'SMS').length,
      resolved,
      resolutionRate: pct(resolved, reports.length),
      duplicates: reports.filter((r) => r.flagged_duplicate || r.status === 'Duplicate').length,
      withResponse,
      avgResolutionHours: average(resolutionHours),
      hotspots,
      heat,
    };
  }

  /* ------------------------------ Multiple parks ------------------------------ */

  analyze(type: AnalysisType, rows: Incident[] | Patrol[] | CommunityReport[], ctx: AnalysisContext): AnalysisSummary {
    if (type === 'INCIDENT') return this.analyzeIncidentTrendsAndHotspots(rows as Incident[], ctx);
    if (type === 'PATROL_COVERAGE') return this.analyzePatrolCoverageAndIdentifyGaps(rows as Patrol[], ctx);
    return this.analyzeConflictPatternsAndHotspots(rows as CommunityReport[], ctx);
  }

  comparisonMetrics(summary: AnalysisSummary): { metrics: ComparisonMetric[]; primary: ComparisonMetric } {
    if (summary.kind === 'INCIDENT') {
      const metrics: ComparisonMetric[] = [
        { label: 'Incidents', value: summary.total },
        { label: 'Resolved', value: summary.resolved },
        { label: 'Manually marked', value: summary.manualShare, unit: '%' },
        { label: 'Top hotspot', value: summary.hotspots[0]?.count ?? 0 },
      ];
      return { metrics, primary: metrics[0] };
    }
    if (summary.kind === 'PATROL_COVERAGE') {
      const metrics: ComparisonMetric[] = [
        { label: 'Patrols', value: summary.total },
        { label: 'Completed', value: summary.completed },
        { label: 'Completion rate', value: summary.completionRate, unit: '%' },
        { label: 'Avg coverage', value: summary.avgCoverage ?? 0, unit: '%' },
        { label: 'Distance', value: summary.totalDistanceKm, unit: 'km' },
        { label: 'Coverage gaps', value: summary.gaps.length },
      ];
      return { metrics, primary: metrics[3] };
    }
    const metrics: ComparisonMetric[] = [
      { label: 'Reports', value: summary.total },
      { label: 'High-risk', value: summary.highRisk },
      { label: 'Resolution rate', value: summary.resolutionRate, unit: '%' },
      { label: 'SMS reports', value: summary.smsCount },
    ];
    return { metrics, primary: metrics[0] };
  }

  generateCombinedParkAnalysis(
    data: MultiParkData,
    ctx: AnalysisContext,
  ): { summary: AnalysisSummary; comparison: ParkComparison[] } {
    const byPark = data.byPark as Record<string, (Incident | Patrol | CommunityReport)[]>;
    const all = ctx.parkIds.flatMap((id) => byPark[id] ?? []);
    const summary = this.analyze(data.type, all as Incident[] | Patrol[] | CommunityReport[], { ...ctx, zoneId: null });
    const comparison = ctx.parkIds.map((parkId) => {
      const sub = this.analyze(data.type, (byPark[parkId] ?? []) as Incident[] | Patrol[] | CommunityReport[], {
        ...ctx,
        parkIds: [parkId],
        zoneId: null,
      });
      return { parkId, parkName: this.parkLabel(ctx, parkId), ...this.comparisonMetrics(sub) };
    });
    return { summary, comparison };
  }

  /* ------------------------------- Presentation ------------------------------- */

  keyMetrics(summary: AnalysisSummary): KeyMetric[] {
    if (summary.kind === 'INCIDENT') {
      return [
        { label: 'Total incidents', value: String(summary.total), sub: `${summary.withCoordinates} with coordinates`, tone: 'default' },
        {
          label: 'Hotspot areas',
          value: String(summary.hotspots.length),
          sub: summary.hotspots[0] ? `Top: ${summary.hotspots[0].count} incidents` : 'No located incidents',
          tone: summary.hotspots.length ? 'critical' : 'default',
        },
        { label: 'Manually marked', value: `${summary.manualShare}%`, sub: `${summary.manuallyMarked} locations`, tone: 'warn' },
        { label: 'Resolved', value: String(summary.resolved), sub: `${pct(summary.resolved, summary.total)}% of incidents`, tone: 'ok' },
      ];
    }
    if (summary.kind === 'PATROL_COVERAGE') {
      return [
        { label: 'Patrols assigned', value: String(summary.total), sub: `${summary.assigned} not started`, tone: 'default' },
        { label: 'Completed', value: String(summary.completed), sub: `${summary.incomplete} incomplete`, tone: 'ok' },
        { label: 'Completion rate', value: `${summary.completionRate}%`, sub: `${summary.inProgress} in progress`, tone: 'info' },
        {
          label: 'Avg. coverage',
          value: summary.avgCoverage === null ? '—' : `${summary.avgCoverage}%`,
          sub: `${summary.totalDistanceKm.toFixed(1)} km covered`,
          tone: summary.avgCoverage !== null && summary.avgCoverage < LOW_COVERAGE_THRESHOLD ? 'warn' : 'default',
        },
      ];
    }
    return [
      { label: 'Conflict reports', value: String(summary.total), sub: `App ${summary.appCount} · SMS ${summary.smsCount}`, tone: 'default' },
      { label: 'High-risk', value: String(summary.highRisk), sub: `${pct(summary.highRisk, summary.total)}% of reports`, tone: 'critical' },
      { label: 'Resolution rate', value: `${summary.resolutionRate}%`, sub: `${summary.resolved} resolved / closed`, tone: 'ok' },
      { label: 'Duplicates flagged', value: String(summary.duplicates), sub: `${summary.withResponse} with ranger response`, tone: 'warn' },
    ];
  }

  findings(results: AnalysisResults): string[] {
    const s = results.summary;
    const out: string[] = [];
    const peak = s.trend.reduce<Datum | null>((best, d) => (d.value > (best?.value ?? 0) ? d : best), null);
    if (s.kind === 'INCIDENT') {
      if (s.byType[0]) out.push(`Most common incident type: ${s.byType[0].label} (${s.byType[0].value} of ${s.total}).`);
      if (s.byZone[0]) out.push(`Highest incident zone: ${s.byZone[0].label} (${pct(s.byZone[0].value, s.total)}%).`);
      if (s.hotspots[0]) out.push(`Top poaching hotspot near ${s.hotspots[0].zoneName} with ${s.hotspots[0].count} incidents.`);
    } else if (s.kind === 'PATROL_COVERAGE') {
      out.push(`${s.completed} of ${s.total} patrols completed (${s.completionRate}%).`);
      if (s.gaps.length) {
        out.push(`${s.gaps.length} coverage gap${s.gaps.length === 1 ? '' : 's'}: ${s.gaps.slice(0, 3).map((g) => g.zoneName).join(', ')}${s.gaps.length > 3 ? '…' : ''}.`);
      } else {
        out.push('No coverage gaps: every zone had a completed patrol with at least 50% coverage.');
      }
      const low = [...s.coverageByZone].filter((z) => z.avgCoverage !== null).sort((a, b) => (a.avgCoverage ?? 0) - (b.avgCoverage ?? 0))[0];
      if (low) out.push(`Lowest average coverage: ${low.zoneName} (${low.avgCoverage}%).`);
    } else {
      if (s.byType[0]) out.push(`Most reported conflict: ${s.byType[0].label} (${s.byType[0].value} of ${s.total}).`);
      out.push(`${s.highRisk} high-risk report${s.highRisk === 1 ? '' : 's'}; ${s.resolutionRate}% resolved or closed.`);
      if (s.hotspots[0]) out.push(`Top conflict hotspot near ${s.hotspots[0].zoneName} with ${s.hotspots[0].count} reports.`);
      if (s.smsCount) out.push(`${pct(s.smsCount, s.total)}% of reports arrived by SMS.`);
    }
    if (peak && peak.value > 0) out.push(`Peak ${s.trendBucket === 'day' ? 'day' : s.trendBucket === 'week' ? 'week' : 'month'}: ${peak.label} (${peak.value}).`);
    if (results.comparison && results.comparison.length > 1) {
      const top = [...results.comparison].sort((a, b) => b.primary.value - a.primary.value)[0];
      out.push(`Highest ${top.primary.label.toLowerCase()} across parks: ${top.parkName} (${formatMetric(top.primary)}).`);
    }
    return out;
  }
}

export function formatMetric(m: ComparisonMetric): string {
  const v = Number.isInteger(m.value) ? String(m.value) : m.value.toFixed(1);
  return m.unit === '%' ? `${v}%` : m.unit === 'km' ? `${v} km` : v;
}

export const analysisEngine = new AnalysisEngine();
