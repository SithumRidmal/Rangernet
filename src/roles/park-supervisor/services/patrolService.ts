import { supabase } from '@shared/lib/supabase';
import { ServiceError, unwrap } from '@shared/utils/errors';
import type { PlannedWaypointPayload } from '../models/PatrolRoute';
import type { PatrolRow, PatrolStatus, RouteRow, WaypointRow } from './rows';

const RANGER_EMBED = 'ranger:profiles!patrols_ranger_id_fkey(id, full_name, employee_id)';
const PATROL_DETAIL_SELECT = `*, route:patrol_routes(*, waypoints(*)), ${RANGER_EMBED}`;
const PATROL_LIST_SELECT = `*, route:patrol_routes(route_id, patrol_id, planned_distance_km, distance_covered, coverage_percent), ${RANGER_EMBED}`;

export type PatrolScope = { supervisorId: string; parkId: string | null };

export type PatrolQuery = {
  statuses?: PatrolStatus[];
  rangerId?: string;
  endedSince?: string;
  limit?: number;
};

export type PatrolWrite = {
  rangerId: string;
  title: string;
  parkId: string | null;
  zoneId: string | null;
  scheduledFor: string | null;
  instructions: string;
  plannedDistanceKm: number | null;
  waypoints: PlannedWaypointPayload[];
};

const routeOf = (row: PatrolRow): RouteRow | null => (Array.isArray(row.route) ? (row.route[0] ?? null) : row.route);

/** Patrols of the supervisor's park (plus any the supervisor assigned elsewhere). */
export async function fetchPatrols(scope: PatrolScope, query: PatrolQuery = {}): Promise<PatrolRow[]> {
  let q = supabase.from('patrols').select(PATROL_LIST_SELECT);
  if (scope.parkId && !query.rangerId) q = q.or(`park_id.eq.${scope.parkId},supervisor_id.eq.${scope.supervisorId}`);
  if (query.statuses?.length) q = q.in('status', query.statuses);
  if (query.rangerId) q = q.eq('ranger_id', query.rangerId);
  if (query.endedSince) q = q.gte('end_time', query.endedSince);
  const rows = unwrap(await q.order('created_at', { ascending: false }).limit(query.limit ?? 300)) as PatrolRow[];
  return rows ?? [];
}

export async function fetchPatrol(patrolId: string): Promise<PatrolRow> {
  const row = unwrap(
    await supabase.from('patrols').select(PATROL_DETAIL_SELECT).eq('patrol_id', patrolId).maybeSingle(),
  ) as PatrolRow | null;
  if (!row) throw new ServiceError('This patrol no longer exists. It may have been deleted.', 'P0002');
  return row;
}

/** Attaches the latest recorded GPS / marked position to each in-progress patrol. */
export async function attachLastPositions(rows: PatrolRow[]): Promise<PatrolRow[]> {
  const active = rows.filter((r) => r.status === 'In Progress' && routeOf(r));
  if (!active.length) return rows;
  const latest = await Promise.all(
    active.map(async (r) => {
      const route = routeOf(r) as RouteRow;
      const res = await supabase
        .from('waypoints')
        .select('*')
        .eq('route_id', route.route_id)
        .in('waypoint_type', ['TRACK', 'MARKED'])
        .order('timestamp', { ascending: false })
        .limit(1);
      const points = (unwrap(res) as WaypointRow[]) ?? [];
      return [r.patrol_id, points] as const;
    }),
  );
  const byPatrol = new Map(latest);
  return rows.map((r) => {
    const points = byPatrol.get(r.patrol_id);
    const route = routeOf(r);
    return points && route ? { ...r, route: { ...route, waypoints: points } } : r;
  });
}

export async function assignPatrol(input: PatrolWrite): Promise<string> {
  const id = unwrap(
    await supabase.rpc('assign_patrol', {
      p_ranger_id: input.rangerId,
      p_title: input.title,
      p_park_id: input.parkId,
      p_zone_id: input.zoneId,
      p_scheduled_for: input.scheduledFor,
      p_instructions: input.instructions,
      p_planned_distance_km: input.plannedDistanceKm,
      p_waypoints: input.waypoints,
    }),
  ) as string;
  return id;
}

export async function updatePatrolRoute(patrolId: string, input: PatrolWrite): Promise<string> {
  unwrap(
    await supabase.rpc('update_patrol_route', {
      p_patrol_id: patrolId,
      p_ranger_id: input.rangerId,
      p_title: input.title,
      p_zone_id: input.zoneId,
      p_scheduled_for: input.scheduledFor,
      p_instructions: input.instructions,
      p_planned_distance_km: input.plannedDistanceKm,
      p_waypoints: input.waypoints,
    }),
  );
  return patrolId;
}

export async function reviewPatrol(patrolId: string, note: string): Promise<void> {
  unwrap(await supabase.rpc('review_patrol', { p_patrol_id: patrolId, p_note: note }));
}

export async function deleteAssignedPatrol(patrolId: string): Promise<void> {
  const deleted = unwrap(
    await supabase.from('patrols').delete().eq('patrol_id', patrolId).eq('status', 'Assigned').select('patrol_id'),
  ) as { patrol_id: string }[] | null;
  if (!deleted?.length) {
    throw new ServiceError('This patrol has already started, so it can no longer be deleted.', '22023');
  }
}
