export type ReportStatus = 'Reported' | 'Under Review' | 'Responding' | 'Resolved' | 'Closed' | 'Duplicate';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ReportChannel = 'APP' | 'SMS';
export type ResponseStatus = 'Assigned' | 'Acknowledged' | 'Responding' | 'Resolved';

export const SEVERITIES: readonly Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export type PersonRow = {
  id: string;
  full_name: string;
  contact_number: string | null;
  village?: string | null;
  employee_id?: string | null;
  park_id?: string | null;
};

export type LocationRow = {
  location_id: string;
  latitude: number | null;
  longitude: number | null;
  manually_marked: boolean;
  location_description: string | null;
  captured_at: string;
};

export type ReportPhotoRow = {
  photo_id: string;
  report_id: string;
  photo_path: string;
  captured_at: string;
};

export type ConflictTypeRow = { type_id: number; type_name: string };

export type AssignmentRow = {
  assignment_id: string;
  report_id: string;
  officer_id: string | null;
  ranger_id: string;
  assigned_at: string;
  response_status: ResponseStatus;
  instructions: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  response_notes: string | null;
  updated_at: string;
  ranger?: PersonRow | PersonRow[] | null;
  officer?: PersonRow | PersonRow[] | null;
};

export type CommunityReportRow = {
  report_id: string;
  report_no: number;
  member_id: string | null;
  type_id: number;
  location_id: string | null;
  park_id: string | null;
  zone_id: string | null;
  description: string;
  reported_at: string;
  status: ReportStatus;
  report_channel: ReportChannel;
  is_offline: boolean;
  severity: Severity | null;
  is_high_risk: boolean;
  flagged_duplicate: boolean;
  duplicate_of: string | null;
  sms_sender: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  assessment_note: string | null;
  updated_at: string;
  conflict_type?: ConflictTypeRow | ConflictTypeRow[] | null;
  location?: LocationRow | LocationRow[] | null;
  photos?: ReportPhotoRow[] | null;
  assignment?: AssignmentRow | AssignmentRow[] | null;
  member?: PersonRow | PersonRow[] | null;
};

/** PostgREST returns one-to-one embeds as an object or a single-item array depending on FK detection. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
