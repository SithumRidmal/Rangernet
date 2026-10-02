import type { LookupType, Park, Zone } from '@shared/types';

export type AnalysisType = 'INCIDENT' | 'PATROL_COVERAGE' | 'CONFLICT';

export const ANALYSIS_TYPES: readonly AnalysisType[] = ['INCIDENT', 'PATROL_COVERAGE', 'CONFLICT'];

export const ANALYSIS_TYPE_LABELS: Record<AnalysisType, string> = {
  INCIDENT: 'Incident Analysis',
  PATROL_COVERAGE: 'Patrol Coverage Analysis',
  CONFLICT: 'Human-Wildlife Conflict Analysis',
};

export const ANALYSIS_TYPE_DESCRIPTIONS: Record<AnalysisType, string> = {
  INCIDENT: 'Incident statistics, trends and poaching hotspots from ranger reports',
  PATROL_COVERAGE: 'Completed patrols, distance, coverage by zone and coverage gaps',
  CONFLICT: 'Community conflict reports, severity, high-risk areas and hotspots',
};

/** Local calendar dates in `YYYY-MM-DD` form. */
export type DateRange = { from: string; to: string };

export type DatePreset = '7d' | '30d' | '90d' | '12m' | 'custom';

export type AnalysisLocation = { parkIds: string[]; zoneId: string | null };

export type AnalysisRequest = {
  type: AnalysisType;
  location: AnalysisLocation;
  dateRange: DateRange;
};

export type FilterErrors = { parks?: string; location?: string; dateRange?: string };

/* ------------------------------ Retrieved rows ------------------------------ */

export type LocationRow = { latitude: number | null; longitude: number | null; manually_marked: boolean };

export type Incident = {
  incident_id: string;
  incident_no: number;
  type_id: number;
  park_id: string | null;
  zone_id: string | null;
  reported_at: string;
  status: string;
  is_offline: boolean;
  type: { type_name: string } | null;
  location: LocationRow | null;
};

export type PatrolRouteRow = {
  planned_distance_km: number | string | null;
  distance_covered: number | string | null;
  coverage_percent: number | string | null;
};

export type Patrol = {
  patrol_id: string;
  patrol_no: number;
  park_id: string | null;
  zone_id: string | null;
  title: string;
  scheduled_for: string | null;
  start_time: string | null;
  end_time: string | null;
  status: 'Assigned' | 'In Progress' | 'Completed' | 'Incomplete';
  route: PatrolRouteRow | null;
};

export type ResponseAssignmentRow = {
  response_status: string;
  assigned_at: string | null;
  resolved_at: string | null;
};

export type CommunityReport = {
  report_id: string;
  report_no: number;
  type_id: number;
  park_id: string | null;
  zone_id: string | null;
  reported_at: string;
  status: string;
  report_channel: 'APP' | 'SMS';
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | null;
  is_high_risk: boolean;
  flagged_duplicate: boolean;
  type: { type_name: string } | null;
  location: LocationRow | null;
  assignment: ResponseAssignmentRow | null;
};

export type MultiParkData =
  | { type: 'INCIDENT'; byPark: Record<string, Incident[]> }
  | { type: 'PATROL_COVERAGE'; byPark: Record<string, Patrol[]> }
  | { type: 'CONFLICT'; byPark: Record<string, CommunityReport[]> };

/* ------------------------------ Analysis results ----------------------------- */

export type Datum = { label: string; value: number };

export type TrendBucket = 'day' | 'week' | 'month';

export type MetricTone = 'default' | 'critical' | 'warn' | 'ok' | 'info';

export type KeyMetric = { label: string; value: string; sub?: string; tone: MetricTone };

export type Hotspot = {
  rank: number;
  latitude: number;
  longitude: number;
  count: number;
  /** Percentage of all located records that fall in this cell. */
  share: number;
  intensity: number;
  zoneName: string;
  parkName: string;
};

export type HeatCell = { id: string; latitude: number; longitude: number; count: number; intensity: number };

export type IncidentAnalysis = {
  kind: 'INCIDENT';
  total: number;
  byType: Datum[];
  byZone: Datum[];
  byStatus: Datum[];
  trend: Datum[];
  trendBucket: TrendBucket;
  withCoordinates: number;
  manuallyMarked: number;
  manualShare: number;
  resolved: number;
  hotspots: Hotspot[];
  heat: HeatCell[];
};

export type ZoneCoverage = {
  zoneId: string;
  zoneName: string;
  parkName: string;
  total: number;
  completed: number;
  avgCoverage: number | null;
};

export type CoverageGap = {
  zoneId: string;
  zoneName: string;
  parkName: string;
  completed: number;
  avgCoverage: number | null;
  reason: 'NO_COMPLETED_PATROL' | 'LOW_COVERAGE';
};

export type PatrolCoverageAnalysis = {
  kind: 'PATROL_COVERAGE';
  total: number;
  assigned: number;
  inProgress: number;
  completed: number;
  incomplete: number;
  completionRate: number;
  avgCoverage: number | null;
  totalDistanceKm: number;
  plannedDistanceKm: number;
  byStatus: Datum[];
  trend: Datum[];
  trendBucket: TrendBucket;
  coverageByZone: ZoneCoverage[];
  gaps: CoverageGap[];
};

export type ConflictAnalysis = {
  kind: 'CONFLICT';
  total: number;
  byType: Datum[];
  bySeverity: Datum[];
  byZone: Datum[];
  byStatus: Datum[];
  trend: Datum[];
  trendBucket: TrendBucket;
  highRisk: number;
  appCount: number;
  smsCount: number;
  resolved: number;
  resolutionRate: number;
  duplicates: number;
  withResponse: number;
  avgResolutionHours: number | null;
  hotspots: Hotspot[];
  heat: HeatCell[];
};

export type AnalysisSummary = IncidentAnalysis | PatrolCoverageAnalysis | ConflictAnalysis;

export type ComparisonMetric = { label: string; value: number; unit?: '%' | 'km' };

export type ParkComparison = {
  parkId: string;
  parkName: string;
  metrics: ComparisonMetric[];
  primary: ComparisonMetric;
};

export type AnalysisResults = {
  analysisId: string;
  analysisType: AnalysisType;
  parkIds: string[];
  parkNames: string[];
  zoneId: string | null;
  zoneName: string | null;
  dateFrom: string;
  dateTo: string;
  isCombined: boolean;
  recordCount: number;
  analysedAt: string;
  summary: AnalysisSummary;
  comparison: ParkComparison[] | null;
};

export type AnalysisContext = {
  parks: Park[];
  zones: Zone[];
  incidentTypes: LookupType[];
  conflictTypes: LookupType[];
  parkIds: string[];
  zoneId: string | null;
  dateRange: DateRange;
};

/* ---------------------------------- Reports ---------------------------------- */

export type ReportParameters = {
  analysis_type: AnalysisType;
  park_ids: string[];
  park_names: string[];
  zone_id: string | null;
  zone_name: string | null;
  date_from: string;
  date_to: string;
  is_combined: boolean;
};

export type ReportSummary = {
  record_count: number;
  metrics: KeyMetric[];
  findings: string[];
  hotspots: { rank: number; zone: string; park: string; count: number; latitude: number; longitude: number }[];
  pages?: number;
  size_bytes?: number;
};

export type ReportRecord = {
  report_id: string;
  report_no: number;
  analysis_id: string | null;
  manager_id: string;
  report_type: string;
  title: string;
  format: string;
  file_path: string | null;
  parameters: Partial<ReportParameters>;
  summary: Partial<ReportSummary>;
  generated_at: string;
  manager: { full_name: string } | null;
};
