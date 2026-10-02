import { distanceKm } from '@shared/location/LocationService';
import { Waypoint, type WaypointRow } from './Waypoint';

export type PatrolRouteRow = {
  route_id: string;
  patrol_id: string;
  planned_distance_km: number | null;
  distance_covered: number | null;
  coverage_percent: number | null;
  waypoints?: WaypointRow[] | null;
};

/** Same default as app_settings.coverage_radius_km in the migration. */
export const COVERAGE_RADIUS_KM = 0.3;

/** PatrolRoute (class diagram): routeId, patrolId, distanceCovered; addWaypoint(), getRoute(). */
export class PatrolRoute {
  private waypoints: Waypoint[];

  constructor(
    readonly routeId: string | null,
    readonly patrolId: string,
    public distanceCovered: number,
    readonly plannedDistanceKm: number | null,
    public coveragePercent: number | null,
    waypoints: Waypoint[] = [],
  ) {
    this.waypoints = waypoints;
  }

  static fromRow(patrolId: string, row: PatrolRouteRow | null): PatrolRoute {
    if (!row) return new PatrolRoute(null, patrolId, 0, null, null);
    return new PatrolRoute(
      row.route_id,
      patrolId,
      Number(row.distance_covered ?? 0),
      row.planned_distance_km === null ? null : Number(row.planned_distance_km),
      row.coverage_percent === null ? null : Number(row.coverage_percent),
      (row.waypoints ?? []).map(Waypoint.fromRow),
    );
  }

  addWaypoint(waypoint: Waypoint) {
    this.waypoints = [...this.waypoints, waypoint];
  }

  /** getRoute(): List<Waypoint> - recorded route (GPS track + marked waypoints) in time order. */
  getRoute(): Waypoint[] {
    return this.waypoints
      .filter((w) => w.waypointType !== 'PLANNED')
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  plannedWaypoints(): Waypoint[] {
    return this.waypoints
      .filter((w) => w.waypointType === 'PLANNED')
      .sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0));
  }

  markedWaypoints(): Waypoint[] {
    return this.getRoute().filter((w) => w.waypointType === 'MARKED');
  }

  /** Same calculation as calculate_patrol_coverage() on the server, used while offline. */
  static calculate(planned: Waypoint[], recorded: { latitude: number; longitude: number }[], plannedDistanceKm: number | null) {
    let distance = 0;
    for (let i = 1; i < recorded.length; i++) distance += distanceKm(recorded[i - 1], recorded[i]);
    const visited = planned.filter((p) => recorded.some((r) => distanceKm(p, r) <= COVERAGE_RADIUS_KM)).length;
    let coverage: number | null = null;
    if (planned.length > 0) coverage = Math.round((1000 * visited) / planned.length) / 10;
    else if (plannedDistanceKm && plannedDistanceKm > 0) coverage = Math.min(100, Math.round((1000 * distance) / plannedDistanceKm) / 10);
    return { distanceKm: distance, coveragePercent: coverage, plannedCount: planned.length, visitedCount: visited };
  }
}
