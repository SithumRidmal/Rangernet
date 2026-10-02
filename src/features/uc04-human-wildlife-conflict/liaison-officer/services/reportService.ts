import { supabase } from '@shared/lib/supabase';
import { unwrap } from '@shared/utils/errors';
import { CommunityReport } from '../models/CommunityReport';
import { ResponseAssignment } from '../models/ResponseAssignment';
import { one, type AssignmentRow, type CommunityReportRow, type ResponseStatus } from './rows';

export type ReportFilter = 'New' | 'Under Review' | 'Responding' | 'Closed' | 'Duplicates';
export const REPORT_FILTERS: readonly ReportFilter[] = ['New', 'Under Review', 'Responding', 'Closed', 'Duplicates'];

const RANGER_EMBED = 'ranger:profiles!response_assignments_ranger_id_fkey(id, full_name, contact_number, employee_id, park_id)';
const MEMBER_EMBED = 'member:profiles!community_reports_member_id_fkey(id, full_name, contact_number, village)';
const REPORT_CORE = `*, conflict_type:conflict_types(type_id, type_name), location:locations(*), ${MEMBER_EMBED}`;
const REPORT_LIST_SELECT = `${REPORT_CORE}, assignment:response_assignments(*, ${RANGER_EMBED})`;
const REPORT_DETAIL_SELECT = `${REPORT_CORE}, photos:report_photos(*), assignment:response_assignments(*, ${RANGER_EMBED})`;

const OPEN_STATUSES = ['Reported', 'Under Review', 'Responding'];

function toReports(data: unknown): CommunityReport[] {
  return ((data ?? []) as CommunityReportRow[]).map(CommunityReport.fromRow);
}

/** Open reports shown on the operations dashboard. */
export async function fetchOpenReports(): Promise<CommunityReport[]> {
  const res = await supabase
    .from('community_reports')
    .select(REPORT_LIST_SELECT)
    .in('status', OPEN_STATUSES)
    .order('reported_at', { ascending: false })
    .limit(200);
  return toReports(unwrap(res));
}

export async function fetchReports(filter: ReportFilter): Promise<CommunityReport[]> {
  let q = supabase.from('community_reports').select(REPORT_LIST_SELECT);
  switch (filter) {
    case 'New':
      q = q.eq('status', 'Reported');
      break;
    case 'Under Review':
      q = q.eq('status', 'Under Review');
      break;
    case 'Responding':
      q = q.eq('status', 'Responding');
      break;
    case 'Closed':
      q = q.in('status', ['Resolved', 'Closed']);
      break;
    case 'Duplicates':
      q = q.or('flagged_duplicate.eq.true,status.eq.Duplicate');
      break;
  }
  const res = await q.order('reported_at', { ascending: false }).limit(200);
  return toReports(unwrap(res));
}

export async function fetchReport(reportId: string): Promise<CommunityReport | null> {
  const res = await supabase.from('community_reports').select(REPORT_DETAIL_SELECT).eq('report_id', reportId).maybeSingle();
  const row = unwrap(res) as CommunityReportRow | null;
  return row ? CommunityReport.fromRow(row) : null;
}

/** Duplicate report exception: the CLO confirms (status Duplicate) or clears the system flag. */
export async function resolveDuplicateFlag(reportId: string, isDuplicate: boolean): Promise<void> {
  unwrap(await supabase.rpc('resolve_duplicate_flag', { p_report_id: reportId, p_is_duplicate: isDuplicate }));
}

/* ------------------------------- Responses -------------------------------- */

export type ResponseItem = { assignment: ResponseAssignment; report: CommunityReport };

type AssignmentWithReportRow = AssignmentRow & { report: CommunityReportRow | CommunityReportRow[] | null };

function toResponseItem(row: AssignmentWithReportRow): ResponseItem | null {
  const reportRow = one(row.report);
  if (!reportRow) return null;
  const assignment = ResponseAssignment.fromRow(row);
  const report = CommunityReport.fromRow(reportRow);
  report.assignment = assignment;
  return { assignment, report };
}

export async function fetchResponses(status: ResponseStatus | 'All'): Promise<ResponseItem[]> {
  let q = supabase.from('response_assignments').select(`*, ${RANGER_EMBED}, report:community_reports(${REPORT_CORE})`);
  if (status !== 'All') q = q.eq('response_status', status);
  const res = await q.order('assigned_at', { ascending: false }).limit(200);
  return ((unwrap(res) ?? []) as AssignmentWithReportRow[]).map(toResponseItem).filter((x): x is ResponseItem => x !== null);
}

export async function fetchResponse(assignmentId: string): Promise<ResponseItem | null> {
  const res = await supabase
    .from('response_assignments')
    .select(`*, ${RANGER_EMBED}, report:community_reports(${REPORT_CORE}, photos:report_photos(*))`)
    .eq('assignment_id', assignmentId)
    .maybeSingle();
  const row = unwrap(res) as AssignmentWithReportRow | null;
  return row ? toResponseItem(row) : null;
}

/* -------------------------------- Rangers --------------------------------- */

export type RangerOption = {
  id: string;
  fullName: string;
  employeeId: string | null;
  contactNumber: string | null;
  parkId: string | null;
  activeResponses: number;
};

/**
 * Patrols are not readable by the CLO under RLS, so availability is derived only
 * from active response assignments.
 */
export async function fetchRangers(): Promise<RangerOption[]> {
  const [profiles, active] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, employee_id, contact_number, park_id')
      .eq('role', 'ranger')
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('response_assignments').select('ranger_id').neq('response_status', 'Resolved'),
  ]);
  const people = (unwrap(profiles) ?? []) as {
    id: string;
    full_name: string;
    employee_id: string | null;
    contact_number: string | null;
    park_id: string | null;
  }[];
  const counts = new Map<string, number>();
  ((unwrap(active) ?? []) as { ranger_id: string }[]).forEach((r) => counts.set(r.ranger_id, (counts.get(r.ranger_id) ?? 0) + 1));
  return people.map((p) => ({
    id: p.id,
    fullName: p.full_name || 'Ranger',
    employeeId: p.employee_id,
    contactNumber: p.contact_number,
    parkId: p.park_id,
    activeResponses: counts.get(p.id) ?? 0,
  }));
}
