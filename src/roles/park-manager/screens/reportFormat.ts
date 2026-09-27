import { formatCode, formatDate } from '@shared/utils/format';
import type { ReportRecord } from '../models/types';

export function reportParks(r: ReportRecord, parkName: (id: string) => string): string {
  const names = r.parameters.park_names?.length ? r.parameters.park_names : (r.parameters.park_ids ?? []).map(parkName);
  if (names.length === 0) return '—';
  return names.length > 2 ? `${names.length} parks` : names.join(', ');
}

export function reportMeta(r: ReportRecord, parkName: (id: string) => string): string {
  return `${formatCode('RPT', r.report_no)} · ${formatDate(r.generated_at)} · ${reportParks(r, parkName)}`;
}

export function formatBytes(bytes: number | undefined): string | null {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
