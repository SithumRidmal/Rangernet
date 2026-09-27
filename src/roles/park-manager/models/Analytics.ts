import { supabase } from '@shared/lib/supabase';
import { unwrap } from '@shared/utils/errors';
import type { AnalysisEngine } from '../services/AnalysisEngine';
import type { DataRepository } from './DataRepository';
import type {
  AnalysisContext,
  AnalysisResults,
  AnalysisType,
  CommunityReport,
  ConflictAnalysis,
  DateRange,
  Hotspot,
  Incident,
  IncidentAnalysis,
  Patrol,
  PatrolCoverageAnalysis,
} from './types';

export type AnalyticsInit = {
  analysisId: string;
  analysisType: AnalysisType;
  dateRange: DateRange;
  parkIds: string[];
  zoneId: string | null;
};

/**
 * Analytics (class diagram): one analysis run over the selected parks, location and
 * date range. Uses the DataRepository to retrieve records and the AnalysisEngine to analyse them.
 */
export class Analytics {
  readonly analysisId: string;
  readonly analysisType: AnalysisType;
  readonly dateRange: DateRange;
  readonly parkIds: string[];
  readonly zoneId: string | null;
  private incidents: Incident[] | null = null;

  constructor(
    init: AnalyticsInit,
    private readonly repository: DataRepository,
    private readonly engine: AnalysisEngine,
    private readonly context: AnalysisContext,
  ) {
    this.analysisId = init.analysisId;
    this.analysisType = init.analysisType;
    this.dateRange = init.dateRange;
    this.parkIds = init.parkIds;
    this.zoneId = init.zoneId;
  }

  get isCombined(): boolean {
    return this.parkIds.length > 1;
  }

  private async loadIncidents(): Promise<Incident[]> {
    if (!this.incidents) {
      this.incidents = await this.repository.retrieveIncidentData(this.parkIds, this.zoneId, this.dateRange);
    }
    return this.incidents;
  }

  async analyzeIncidents(onRetrieved?: () => void): Promise<IncidentAnalysis> {
    const incidents = await this.loadIncidents();
    onRetrieved?.();
    return this.engine.analyzeIncidentTrendsAndHotspots(incidents, this.context);
  }

  async analyzePatrolCoverage(onRetrieved?: () => void): Promise<PatrolCoverageAnalysis> {
    const patrols: Patrol[] = await this.repository.retrievePatrolInformation(this.parkIds, this.zoneId, this.dateRange);
    onRetrieved?.();
    return this.engine.analyzePatrolCoverageAndIdentifyGaps(patrols, this.context);
  }

  async analyzeConflictTrends(onRetrieved?: () => void): Promise<ConflictAnalysis> {
    const reports: CommunityReport[] = await this.repository.retrieveConflictReports(this.parkIds, this.zoneId, this.dateRange);
    onRetrieved?.();
    return this.engine.analyzeConflictPatternsAndHotspots(reports, this.context);
  }

  async identifyPoachingHotspots(): Promise<Hotspot[]> {
    const incidents = await this.loadIncidents();
    const points = incidents
      .map((i) => i.location)
      .filter((l): l is { latitude: number; longitude: number; manually_marked: boolean } =>
        !!l && typeof l.latitude === 'number' && typeof l.longitude === 'number',
      );
    return this.engine.identifyHotspots(points, this.context).hotspots;
  }

  /** Stores the analysis run in the `analytics` table (results kept as jsonb). */
  async save(requestedBy: string, results: AnalysisResults): Promise<void> {
    unwrap(
      await supabase.from('analytics').insert({
        analysis_id: this.analysisId,
        analysis_type: this.analysisType,
        date_from: this.dateRange.from,
        date_to: this.dateRange.to,
        park_ids: this.parkIds,
        zone_id: this.isCombined ? null : this.zoneId,
        is_combined: this.isCombined,
        requested_by: requestedBy,
        results,
      }),
    );
  }

  static async load(analysisId: string): Promise<AnalysisResults | null> {
    const row = unwrap(
      await supabase.from('analytics').select('analysis_id, results').eq('analysis_id', analysisId).maybeSingle(),
    ) as { analysis_id: string; results: AnalysisResults | null } | null;
    if (!row?.results || !row.results.summary) return null;
    return { ...row.results, analysisId: row.analysis_id };
  }
}
