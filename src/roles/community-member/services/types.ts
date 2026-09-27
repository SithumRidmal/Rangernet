export type ReportStatus = 'Reported' | 'Under Review' | 'Responding' | 'Resolved' | 'Closed' | 'Duplicate';
export type ReportChannel = 'APP' | 'SMS';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ResponseStatus = 'Assigned' | 'Acknowledged' | 'Responding' | 'Resolved';

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

export type AssignmentRow = {
  assignment_id: string;
  report_id: string;
  assigned_at: string;
  response_status: ResponseStatus;
  acknowledged_at: string | null;
  resolved_at: string | null;
  response_notes: string | null;
  updated_at: string;
};

export type CommunityReportRow = {
  report_id: string;
  report_no: number;
  member_id: string | null;
  type_id: number;
  description: string;
  reported_at: string;
  status: ReportStatus;
  report_channel: ReportChannel;
  is_offline: boolean;
  severity: Severity | null;
  is_high_risk: boolean;
  flagged_duplicate: boolean;
  reviewed_at: string | null;
  assessment_note: string | null;
  updated_at: string;
  conflict_type: { type_id: number; type_name: string } | null;
  location: LocationRow | null;
  photos: ReportPhotoRow[] | null;
  assignment: AssignmentRow | AssignmentRow[] | null;
};

/** Parameters of the submit_community_report RPC (Data Repository). */
export type SubmitReportParams = {
  p_report_id: string;
  p_type_id: number;
  p_description: string;
  p_latitude: number | null;
  p_longitude: number | null;
  p_manually_marked: boolean;
  p_location_description: string | null;
  p_reported_at: string;
  p_is_offline: boolean;
  p_photos: { photo_id: string; photo_path: string; captured_at: string }[];
};

export type SubmitReportResult = {
  report_id: string;
  report_no: number;
  status: ReportStatus;
  flagged_duplicate: boolean;
  already_stored: boolean;
};

/** Record kept in Local Storage while the report is "Pending Synchronization". */
export type CommunityReportPayload = {
  ownerId: string;
  reportId: string;
  typeId: number;
  typeName: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  manuallyMarked: boolean;
  locationDescription: string | null;
  accuracy: number | null;
  reportedAt: string;
  photos: { photoId: string; uri: string; capturedAt: string }[];
};
