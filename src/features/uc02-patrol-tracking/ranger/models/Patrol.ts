import type { GeoPoint } from '@shared/location/LocationService';
import { formatCode } from '@shared/utils/format';
import { PatrolRoute, type PatrolRouteRow } from './PatrolRoute';
import { Waypoint } from './Waypoint';

export type PatrolStatus = 'Assigned' | 'In Progress' | 'Completed' | 'Incomplete';

export type PatrolRow = {
  patrol_id: string;
  patrol_no: number;
  ranger_id: string;
  supervisor_id: string | null;
  park_id: string | null;
  zone_id: string | null;
  title: string;
  instructions: string | null;
  scheduled_for: string | null;
  start_time: string | null;
  end_time: string | null;
  status: PatrolStatus;
  incomplete_reason: string | null;
  route_updated_at: string | null;
  reviewed_at: string | null;
  supervisor_note: string | null;
  route: PatrolRouteRow | PatrolRouteRow[] | null;
};

/** Patrol (class diagram): patrolId, rangerId, startTime, endTime, status; startPatrol(), recordGPSPosition(). */
export class Patrol {
  readonly patrolId: string;
  readonly rangerId: string;
  startTime: string | null;
  endTime: string | null;
  status: PatrolStatus;
  readonly route: PatrolRoute;

  private constructor(readonly row: PatrolRow) {
    this.patrolId = row.patrol_id;
    this.rangerId = row.ranger_id;
    this.startTime = row.start_time;
    this.endTime = row.end_time;
    this.status = row.status;
    const routeRow = Array.isArray(row.route) ? (row.route[0] ?? null) : row.route;
    this.route = PatrolRoute.fromRow(row.patrol_id, routeRow);
  }

  static fromRow(row: PatrolRow): Patrol {
    return new Patrol(row);
  }

  get code() {
    return formatCode('PAT', this.row.patrol_no);
  }
  get title() {
    return this.row.title;
  }
  get instructions() {
    return this.row.instructions;
  }
  get scheduledFor() {
    return this.row.scheduled_for;
  }
  get zoneId() {
    return this.row.zone_id;
  }
  get parkId() {
    return this.row.park_id;
  }
  get routeUpdatedAt() {
    return this.row.route_updated_at;
  }
  get incompleteReason() {
    return this.row.incomplete_reason;
  }
  get supervisorNote() {
    return this.row.supervisor_note;
  }
  get reviewedAt() {
    return this.row.reviewed_at;
  }

  /** startPatrol(): creates the patrol session and records the start time (UC-02 step 4). */
  startPatrol(startTime = new Date().toISOString()) {
    this.status = 'In Progress';
    this.startTime = startTime;
  }

  /** recordGPSPosition(): continuous tracking point (UC-02 step 5). */
  recordGPSPosition(point: GeoPoint): Waypoint {
    const waypoint = Waypoint.create({
      latitude: point.latitude,
      longitude: point.longitude,
      manuallyMarked: false,
      waypointType: 'TRACK',
      timestamp: new Date(point.timestamp).toISOString(),
    });
    this.route.addWaypoint(waypoint);
    return waypoint;
  }

  /** Manual waypoint (UC-02 step 6 / alternative flows 7a and 11a). */
  markWaypoint(init: { latitude: number; longitude: number; manuallyMarked: boolean; note?: string | null }): Waypoint {
    const waypoint = Waypoint.create({ ...init, waypointType: 'MARKED' });
    this.route.addWaypoint(waypoint);
    return waypoint;
  }
}
