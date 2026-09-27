import { formatDate, formatTime } from '@shared/utils/format';

/** Compact timestamp for timelines: time only for today, otherwise date and time. */
export function stamp(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatTime(d);
  return `${formatDate(d).replace(/ \d{4}$/, '')} ${formatTime(d)}`;
}
