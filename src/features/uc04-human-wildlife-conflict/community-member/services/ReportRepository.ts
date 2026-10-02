import { supabase } from '@shared/lib/supabase';
import { cacheGet, cacheSet } from '@shared/sync/localDb';
import { unwrap } from '@shared/utils/errors';
import type { AssignmentRow, CommunityReportRow, SubmitReportParams, SubmitReportResult } from './types';

const REPORT_SELECT =
  '*, conflict_type:conflict_types(type_id, type_name), location:locations(*), photos:report_photos(*), assignment:response_assignments(*)';

const cacheKey = (memberId: string) => `community:my-reports:${memberId}`;

export type CachedReports = { rows: CommunityReportRow[]; savedAt: string };

export function assignmentOf(row: CommunityReportRow): AssignmentRow | null {
  if (!row.assignment) return null;
  return Array.isArray(row.assignment) ? row.assignment[0] ?? null : row.assignment;
}

/** Data Repository: stores the report in the Central Operations System (validates, detects duplicates). */
export async function storeCommunityReport(params: SubmitReportParams): Promise<SubmitReportResult> {
  return unwrap(await supabase.rpc('submit_community_report', params)) as SubmitReportResult;
}

/** Reports of the signed-in member (RLS limits the rows to member_id = auth.uid()). */
export async function fetchMyReports(memberId: string): Promise<CommunityReportRow[]> {
  const rows = unwrap(
    await supabase
      .from('community_reports')
      .select(REPORT_SELECT)
      .eq('member_id', memberId)
      .order('reported_at', { ascending: false }),
  ) as CommunityReportRow[];
  await cacheSet<CachedReports>(cacheKey(memberId), { rows, savedAt: new Date().toISOString() }).catch(() => undefined);
  return rows;
}

export function readCachedReports(memberId: string): Promise<CachedReports | null> {
  return cacheGet<CachedReports>(cacheKey(memberId)).catch(() => null);
}

export async function fetchReport(reportId: string): Promise<CommunityReportRow | null> {
  return unwrap(
    await supabase.from('community_reports').select(REPORT_SELECT).eq('report_id', reportId).maybeSingle(),
  ) as CommunityReportRow | null;
}
