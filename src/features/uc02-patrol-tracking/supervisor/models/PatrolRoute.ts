import type { LatLng } from 'react-native-maps';
import { distanceKm } from '@shared/location/LocationService';
import type { RouteRow } from '../services/rows';
import { Waypoint } from './Waypoint';

export type PlannedWaypointPayload = { latitude: number; longitude: number; note: string | null };

const toNumber = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pathLength = (points: LatLng[]) =>
  points.reduce((sum, p, i) => (i === 0 ? 0 : sum + distanceKm(points[i - 1], p)), 0);

/** Class diagram: PatrolRoute (composition 1-1 of Patrol, composes 0..* Waypoint). */
export class PatrolRoute {
  private readonly waypoints: Waypoint[] = [];

  constructor(
    readonly routeId: string | null,
    readonly patrolId: string | null,
    readonly distanceCovered: number,
    readonly plannedDistanceKm: number | null = null,
    readonly coveragePercent: number | null = null,
    waypoints: Waypoint[] = [],
  ) {
    waypoints.forEach((w) => this.addWaypoint(w));
  }

  static fromRow(row: RouteRow | null, patrolId: string): PatrolRoute {
    if (!row) return new PatrolRoute(null, patrolId, 0);
    return new PatrolRoute(
      row.route_id,
      row.patrol_id ?? patrolId,
      toNumber(row.distance_covered) ?? 0,
      toNumber(row.planned_distance_km),
      toNumber(row.coverage_percent),
      (row.waypoints ?? []).map((w) => Waypoint.fromRow(w)),
    );
  }

  /** Route drawn by the supervisor on the assign / edit form. */
  static plan(points: { latitude: number; longitude: number; note?: string | null }[]): PatrolRoute {
    const route = new PatrolRoute(null, null, 0);
    points.forEach((p, i) => route.addWaypoint(Waypoint.planned(i + 1, p.latitude, p.longitude, p.note ?? null)));
    return route;
  }

  addWaypoint(waypoint: Waypoint): void {
    this.waypoints.push(waypoint);
  }

  /** Every waypoint of the route: planned in sequence order, then recorded points by time. */
  getRoute(): Waypoint[] {
    return [...this.getPlannedWaypoints(), ...this.getTrack()];
  }

  getPlannedWaypoints(): Waypoint[] {
    return this.waypoints
      .filter((w) => w.isPlanned())
      .sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0));
  }

  /** Positions recorded during the patrol (GPS track and marked waypoints), ordered by time. */
  getTrack(): Waypoint[] {
    return this.waypoints
      .filter((w) => w.isTrackPoint())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getMarkedWaypoints(): Waypoint[] {
    return this.getTrack().filter((w) => w.isMarked());
  }

  getLastPosition(): Waypoint | null {
    const track = this.getTrack();
    return track.length ? track[track.length - 1] : null;
  }

  /** Planned distance measured along the drawn waypoints. */
  measurePlannedDistanceKm(): number {
    return pathLength(this.getPlannedWaypoints().map((w) => w.getLocation()));
  }

  toPlannedPayload(): PlannedWaypointPayload[] {
    return this.getPlannedWaypoints().map((w) => ({ latitude: w.latitude, longitude: w.longitude, note: w.note }));
  }
}
