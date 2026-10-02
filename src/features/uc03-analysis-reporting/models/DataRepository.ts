import { supabase } from '@shared/lib/supabase';
import { getErrorMessage } from '@shared/utils/errors';
import { rangeBounds } from '../services/dates';
import type {
  AnalysisType,
  CommunityReport,
  DateRange,
  Incident,
  LocationRow,
  MultiParkData,
  Patrol,
  PatrolRouteRow,
  ResponseAssignmentRow,
} from './types';

/** Raised when the Data Repository cannot retrieve records (UC-03 exception "Data Retrieval Failure"). */
export class DataRetrievalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataRetrievalError';
  }
}

export type OverviewStats = {
  incidents: number;
  patrolsCompleted: number;
  avgCoverage: number | null;
  conflictReports: number;
};

type PageResult = { data: unknown; error: { message: string } | null };

const PAGE_SIZE = 1000;

const INCIDENT_COLUMNS =
  'incident_id, incident_no, type_id, park_id, zone_id, reported_at, status, is_offline, ' +
  'type:incident_types(type_name), location:locations(latitude, longitude, manually_marked)';

const PATROL_COLUMNS =
  'patrol_id, patrol_no, park_id, zone_id, title, scheduled_for, start_time, end_time, status, ' +
  'route:patrol_routes(planned_distance_km, distance_covered, coverage_percent)';

const CONFLICT_COLUMNS =
  'report_id, report_no, type_id, park_id, zone_id, reported_at, status, report_channel, severity, is_high_risk, ' +
  'flagged_duplicate, type:conflict_types(type_name), location:locations(latitude, longitude, manually_marked), ' +
  'assignment:response_assignments(response_status, assigned_at, resolved_at)';

/** PostgREST returns one-to-one embeds as an object, but older schemas may return a single-item array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<PageResult>, what: string): Promise<T[]> {
  const rows: T[] = [];
  try {
    for (let from = 0; ; from += PAGE_SIZE) {
      const res = await page(from, from + PAGE_SIZE - 1);
      if (res.error) throw new DataRetrievalError(`Could not retrieve ${what}: ${res.error.message}`);
      const batch = (Array.isArray(res.data) ? res.data : []) as T[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }
  } catch (e) {
    if (e instanceof DataRetrievalError) throw e;
    throw new DataRetrievalError(getErrorMessage(e, `Could not retrieve ${what}.`));
  }
  return rows;
}

function groupByPark<T extends { park_id: string | null }>(rows: T[], parkList: string[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  parkList.forEach((id) => (out[id] = []));
  rows.forEach((r) => {
    if (r.park_id && out[r.park_id]) out[r.park_id].push(r);
  });
  return out;
}

/**
 * DataRepository (class diagram). Reads the operational records UC-03 analyses.
 * Parks are filtered with `park_id IN parkList`, the optional location with `zone_id`,
 * and the date range on each table's event column.
 */
export class DataRepository {
  async retrieveIncidentData(park: string | string[], location: string | null, dateRange: DateRange): Promise<Incident[]> {
    const parks = Array.isArray(park) ? park : [park];
    const { fromIso, toIso } = rangeBounds(dateRange);
    const rows = await fetchAll<Incident>((from, to) => {
      let q = supabase
        .from('incidents')
        .select(INCIDENT_COLUMNS)
        .in('park_id', parks)
        .gte('reported_at', fromIso)
        .lte('reported_at', toIso);
      if (location) q = q.eq('zone_id', location);
      return q.order('reported_at', { ascending: true }).order('incident_id').range(from, to);
    }, 'incident records');
    return rows.map((r) => ({ ...r, type: one(r.type), location: one<LocationRow>(r.location) }));
  }

  /** Patrols are dated by their start time, or by the scheduled date when not started yet. */
  async retrievePatrolInformation(park: string | string[], location: string | null, dateRange: DateRange): Promise<Patrol[]> {
    const parks = Array.isArray(park) ? park : [park];
    const { fromIso, toIso } = rangeBounds(dateRange);
    const rows = await fetchAll<Patrol>((from, to) => {
      let q = supabase
        .from('patrols')
        .select(PATROL_COLUMNS)
        .in('park_id', parks)
        .or(
          `and(start_time.gte."${fromIso}",start_time.lte."${toIso}"),` +
            `and(start_time.is.null,scheduled_for.gte."${fromIso}",scheduled_for.lte."${toIso}")`,
        );
      if (location) q = q.eq('zone_id', location);
      return q.order('patrol_no', { ascending: true }).range(from, to);
    }, 'patrol information');
    return rows.map((r) => ({ ...r, route: one<PatrolRouteRow>(r.route) }));
  }

  async retrieveConflictReports(park: string | string[], location: string | null, dateRange: DateRange): Promise<CommunityReport[]> {
    const parks = Array.isArray(park) ? park : [park];
    const { fromIso, toIso } = rangeBounds(dateRange);
    const rows = await fetchAll<CommunityReport>((from, to) => {
      let q = supabase
        .from('community_reports')
        .select(CONFLICT_COLUMNS)
        .in('park_id', parks)
        .gte('reported_at', fromIso)
        .lte('reported_at', toIso);
      if (location) q = q.eq('zone_id', location);
      return q.order('reported_at', { ascending: true }).order('report_id').range(from, to);
    }, 'conflict reports');
    return rows.map((r) => ({
      ...r,
      type: one(r.type),
      location: one<LocationRow>(r.location),
      assignment: one<ResponseAssignmentRow>(r.assignment),
    }));
  }

  /** Alternative flow "Multiple Parks": one query for every selected park, grouped per park. */
  async retrieveMultiParkData(
    parkList: string[],
    type: AnalysisType,
    location: string | null,
    dateRange: DateRange,
  ): Promise<MultiParkData> {
    if (type === 'INCIDENT') {
      return { type, byPark: groupByPark(await this.retrieveIncidentData(parkList, location, dateRange), parkList) };
    }
    if (type === 'PATROL_COVERAGE') {
      return { type, byPark: groupByPark(await this.retrievePatrolInformation(parkList, location, dateRange), parkList) };
    }
    return { type, byPark: groupByPark(await this.retrieveConflictReports(parkList, location, dateRange), parkList) };
  }

  retrievePatrolData(park: string | string[], location: string | null, dateRange: DateRange): Promise<Patrol[]> {
    return this.retrievePatrolInformation(park, location, dateRange);
  }

  retrieveCommunityData(park: string | string[], location: string | null, dateRange: DateRange): Promise<CommunityReport[]> {
    return this.retrieveConflictReports(park, location, dateRange);
  }

  /** Operations overview for the manager dashboard (all parks, last `days` days). */
  async retrieveOverview(days = 30): Promise<OverviewStats> {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    try {
      const [incidents, conflicts, patrols] = await Promise.all([
        supabase.from('incidents').select('incident_id', { count: 'exact', head: true }).gte('reported_at', since),
        supabase.from('community_reports').select('report_id', { count: 'exact', head: true }).gte('reported_at', since),
        fetchAll<{ route: PatrolRouteRow | PatrolRouteRow[] | null }>(
          (from, to) =>
            supabase
              .from('patrols')
              .select('patrol_id, route:patrol_routes(coverage_percent)')
              .eq('status', 'Completed')
              .gte('end_time', since)
              .order('patrol_no')
              .range(from, to),
          'patrols',
        ),
      ]);
      if (incidents.error) throw new DataRetrievalError(incidents.error.message);
      if (conflicts.error) throw new DataRetrievalError(conflicts.error.message);
      const coverage = patrols
        .map((p) => one(p.route)?.coverage_percent)
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map(Number)
        .filter((v) => Number.isFinite(v));
      return {
        incidents: incidents.count ?? 0,
        conflictReports: conflicts.count ?? 0,
        patrolsCompleted: patrols.length,
        avgCoverage: coverage.length ? Math.round((coverage.reduce((a, b) => a + b, 0) / coverage.length) * 10) / 10 : null,
      };
    } catch (e) {
      if (e instanceof DataRetrievalError) throw e;
      throw new DataRetrievalError(getErrorMessage(e, 'Could not load the operations overview.'));
    }
  }
}

export const dataRepository = new DataRepository();
