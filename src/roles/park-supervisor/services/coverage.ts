import type { ChartDatum } from '@shared/components';
import type { Zone } from '@shared/types';
import type { Patrol } from '../models/Patrol';

export type CoverageRange = 7 | 30 | 90;
export const COVERAGE_RANGES: readonly CoverageRange[] = [7, 30, 90];

export type ZoneCoverage = { zoneId: string | null; label: string; averageCoverage: number; patrols: number };

export type CoverageAnalysis = {
  rangeDays: CoverageRange;
  completed: number;
  incomplete: number;
  completionRate: number | null;
  averageCoverage: number | null;
  totalKm: number;
  byZone: ZoneCoverage[];
  trend: ChartDatum[];
  incompletePatrols: Patrol[];
  gaps: Zone[];
};

const DAY = 24 * 60 * 60 * 1000;

export function rangeStart(days: CoverageRange, now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return new Date(start.getTime() - (days - 1) * DAY);
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

function buildTrend(finished: Patrol[], days: CoverageRange): ChartDatum[] {
  const bucketDays = days === 7 ? 1 : days === 30 ? 5 : 15;
  const start = rangeStart(days).getTime();
  const buckets = Math.ceil(days / bucketDays);
  return Array.from({ length: buckets }, (_, i) => {
    const from = start + i * bucketDays * DAY;
    const to = from + bucketDays * DAY;
    const d = new Date(from);
    const label = days === 7 ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`;
    const value = finished.filter((p) => {
      const t = p.endTime ? new Date(p.endTime).getTime() : NaN;
      return t >= from && t < to;
    }).length;
    return { label, value };
  });
}

/** Patrol coverage analysis over the finished patrols of the selected period. */
export function analyseCoverage(
  finished: Patrol[],
  zones: Zone[],
  days: CoverageRange,
  zoneName: (id: string | null) => string | null,
): CoverageAnalysis {
  const completed = finished.filter((p) => p.status === 'Completed');
  const incomplete = finished.filter((p) => p.status === 'Incomplete');
  const coverages = finished
    .map((p) => p.getRoute().coveragePercent)
    .filter((c): c is number => c !== null && Number.isFinite(c));

  const zoneGroups = new Map<string, Patrol[]>();
  finished.forEach((p) => {
    const key = p.zoneId ?? '';
    zoneGroups.set(key, [...(zoneGroups.get(key) ?? []), p]);
  });
  const byZone: ZoneCoverage[] = [...zoneGroups.entries()]
    .map(([key, list]) => {
      const values = list
        .map((p) => p.getRoute().coveragePercent)
        .filter((c): c is number => c !== null && Number.isFinite(c));
      return {
        zoneId: key || null,
        label: (key && zoneName(key)) || 'No zone set',
        averageCoverage: Math.round((average(values) ?? 0) * 10) / 10,
        patrols: list.length,
      };
    })
    .sort((a, b) => b.averageCoverage - a.averageCoverage);

  const coveredZones = new Set(completed.map((p) => p.zoneId).filter(Boolean));
  return {
    rangeDays: days,
    completed: completed.length,
    incomplete: incomplete.length,
    completionRate: finished.length ? Math.round((completed.length / finished.length) * 100) : null,
    averageCoverage: coverages.length ? Math.round((average(coverages) ?? 0) * 10) / 10 : null,
    totalKm: finished.reduce((sum, p) => sum + p.getRoute().distanceCovered, 0),
    byZone,
    trend: buildTrend(finished, days),
    incompletePatrols: incomplete,
    gaps: zones.filter((z) => !coveredZones.has(z.zone_id)),
  };
}
