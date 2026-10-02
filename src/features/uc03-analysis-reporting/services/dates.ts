import { formatDate, toIsoDate } from '@shared/utils/format';
import type { DatePreset, DateRange } from '../models/types';

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const DATE_PRESETS: readonly DatePreset[] = ['7d', '30d', '90d', '12m', 'custom'];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
  custom: 'Custom',
};

export function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export function presetRange(preset: Exclude<DatePreset, 'custom'>, today = new Date()): DateRange {
  const to = startOfDay(today);
  let from: Date;
  if (preset === '12m') from = addDays(new Date(to.getFullYear() - 1, to.getMonth(), to.getDate()), 1);
  else from = addDays(to, -(Number(preset.replace('d', '')) - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/** Inclusive timestamp bounds (ISO, UTC) for filtering a timestamptz column by local calendar dates. */
export function rangeBounds(range: DateRange): { fromIso: string; toIso: string } {
  const from = parseLocalDate(range.from) ?? new Date(0);
  const to = parseLocalDate(range.to) ?? new Date();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
  return { fromIso: from.toISOString(), toIso: end.toISOString() };
}

export function formatRange(range: { from: string; to: string }): string {
  const a = parseLocalDate(range.from);
  const b = parseLocalDate(range.to);
  if (!a || !b) return '—';
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${formatDate(b)}`;
  }
  return `${formatDate(a)} – ${formatDate(b)}`;
}

export function shortDayLabel(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function monthLabel(d: Date, withYear: boolean): string {
  return withYear ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : MONTHS[d.getMonth()];
}
