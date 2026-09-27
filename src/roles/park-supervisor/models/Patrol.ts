import { ServiceError } from '@shared/utils/errors';
import { formatCode } from '@shared/utils/format';
import type { PatrolRow, PatrolStatus, PersonRef, RouteRow } from '../services/rows';
import { PatrolRoute } from './PatrolRoute';
import type { Waypoint } from './Waypoint';

const RANGER_ONLY = 'Only the assigned ranger can do this from the field app.';

const firstRoute = (route: PatrolRow['route']): RouteRow | null =>
  Array.isArray(route) ? (route[0] ?? null) : route;

/** Class diagram: Patrol. On the supervisor side the tracking data is read-only. */
export class Patrol {
  readonly patrolId: string;
  readonly patrolNo: number;
  readonly rangerId: string;
  readonly supervisorId: string | null;
  readonly parkId: string | null;
  readonly zoneId: string | null;
  readonly title: string;
  readonly instructions: string | null;
  readonly scheduledFor: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly status: PatrolStatus;
  readonly incompleteReason: string | null;
  readonly routeUpdatedAt: string | null;
  readonly reviewedAt: string | null;
  readonly supervisorNote: string | null;
  readonly createdAt: string;
  readonly ranger: PersonRef | null;
  private readonly route: PatrolRoute;

  private constructor(private readonly row: PatrolRow) {
    this.patrolId = row.patrol_id;
    this.patrolNo = row.patrol_no;
    this.rangerId = row.ranger_id;
    this.supervisorId = row.supervisor_id;
    this.parkId = row.park_id;
    this.zoneId = row.zone_id;
    this.title = row.title;
    this.instructions = row.instructions;
    this.scheduledFor = row.scheduled_for;
    this.startTime = row.start_time;
    this.endTime = row.end_time;
    this.status = row.status;
    this.incompleteReason = row.incomplete_reason;
    this.routeUpdatedAt = row.route_updated_at;
    this.reviewedAt = row.reviewed_at;
    this.supervisorNote = row.supervisor_note;
    this.createdAt = row.created_at;
    this.ranger = row.ranger;
    this.route = PatrolRoute.fromRow(firstRoute(row.route), row.patrol_id);
  }

  static fromRow(row: PatrolRow): Patrol {
    return new Patrol(row);
  }

  toRow(): PatrolRow {
    return this.row;
  }

  startPatrol(): never {
    throw new ServiceError(RANGER_ONLY);
  }

  recordGPSPosition(): never {
    throw new ServiceError(RANGER_ONLY);
  }

  getRoute(): PatrolRoute {
    return this.route;
  }

  getCode(): string {
    return formatCode('PAT', this.patrolNo);
  }

  getRangerName(): string {
    return this.ranger?.full_name || 'Unknown ranger';
  }

  getDurationMs(): number | null {
    if (!this.startTime) return null;
    const end = this.endTime ? new Date(this.endTime).getTime() : Date.now();
    return end - new Date(this.startTime).getTime();
  }

  isFinished(): boolean {
    return this.status === 'Completed' || this.status === 'Incomplete';
  }

  isReviewed(): boolean {
    return !!this.reviewedAt;
  }

  /** Completed or Incomplete patrols wait for the supervisor's review (step 9 / exception 14a). */
  needsReview(): boolean {
    return this.isFinished() && !this.isReviewed();
  }

  /** Alternative flow 2a: the route can only change before the ranger starts. */
  canEditRoute(): boolean {
    return this.status === 'Assigned';
  }

  getLastKnownPosition(): Waypoint | null {
    return this.route.getLastPosition();
  }

  /** The most relevant date for lists: end, start or scheduled time depending on status. */
  getDisplayTime(): string | null {
    if (this.isFinished()) return this.endTime ?? this.startTime;
    if (this.status === 'In Progress') return this.startTime;
    return this.scheduledFor ?? this.createdAt;
  }
}
