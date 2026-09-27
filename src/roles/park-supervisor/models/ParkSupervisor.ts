import type { AppRole, Profile, Zone } from '@shared/types';
import {
  assignPatrol as rpcAssignPatrol,
  attachLastPositions,
  deleteAssignedPatrol,
  fetchPatrol,
  fetchPatrols,
  reviewPatrol as rpcReviewPatrol,
  updatePatrolRoute as rpcUpdatePatrolRoute,
  type PatrolQuery,
  type PatrolScope,
  type PatrolWrite,
} from '../services/patrolService';
import { analyseCoverage, rangeStart, type CoverageAnalysis, type CoverageRange } from '../services/coverage';
import { Patrol } from './Patrol';
import type { PatrolRoute } from './PatrolRoute';

export type PatrolAssignmentInput = {
  rangerId: string | null;
  title: string;
  parkId: string | null;
  zoneId: string | null;
  scheduledFor: Date | null;
  instructions: string;
  plannedDistanceText: string;
  route: PatrolRoute;
};

export type AssignmentField = 'ranger' | 'title' | 'park' | 'scheduledFor' | 'waypoints' | 'distance';
export type AssignmentErrors = Partial<Record<AssignmentField, string>>;

export class AssignmentValidationError extends Error {
  constructor(readonly errors: AssignmentErrors) {
    super('Please correct the highlighted fields.');
    this.name = 'AssignmentValidationError';
  }
}

const PAST_TOLERANCE_MS = 5 * 60 * 1000;

export function parseDistance(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

/** Class diagram: ParkSupervisor (1 -> 0..* Patrol). */
export class ParkSupervisor {
  constructor(
    readonly supervisorId: string,
    readonly name: string,
    readonly role: AppRole,
    readonly parkId: string | null,
  ) {}

  static fromProfile(profile: Profile): ParkSupervisor {
    return new ParkSupervisor(profile.id, profile.full_name, profile.role, profile.park_id);
  }

  private get scope(): PatrolScope {
    return { supervisorId: this.supervisorId, parkId: this.parkId };
  }

  validateAssignment(
    input: PatrolAssignmentInput,
    options: { editing: boolean; originalScheduledFor?: string | null } = { editing: false },
  ): AssignmentErrors {
    const errors: AssignmentErrors = {};
    if (!input.rangerId) errors.ranger = 'Select the ranger who will conduct this patrol.';
    if (!input.title.trim()) errors.title = 'Enter a patrol / route name.';
    else if (input.title.trim().length > 120) errors.title = 'Keep the name under 120 characters.';
    if (!options.editing && !input.parkId) errors.park = 'Select the park for this patrol.';
    if (!input.scheduledFor) {
      errors.scheduledFor = 'Choose when the patrol should start.';
    } else {
      const changed =
        !options.editing ||
        !options.originalScheduledFor ||
        new Date(options.originalScheduledFor).getTime() !== input.scheduledFor.getTime();
      if (changed && input.scheduledFor.getTime() < Date.now() - PAST_TOLERANCE_MS) {
        errors.scheduledFor = 'The scheduled time cannot be in the past.';
      }
    }
    if (input.route.getPlannedWaypoints().length < 2) {
      errors.waypoints = 'Tap the map to mark at least a start and an end waypoint.';
    }
    const distance = parseDistance(input.plannedDistanceText);
    if (distance !== null && (Number.isNaN(distance) || distance < 0 || distance > 500)) {
      errors.distance = 'Enter a distance between 0 and 500 km.';
    }
    return errors;
  }

  private toWrite(input: PatrolAssignmentInput): PatrolWrite {
    const distance = parseDistance(input.plannedDistanceText);
    return {
      rangerId: input.rangerId as string,
      title: input.title.trim(),
      parkId: input.parkId,
      zoneId: input.zoneId,
      scheduledFor: input.scheduledFor ? input.scheduledFor.toISOString() : null,
      instructions: input.instructions.trim(),
      plannedDistanceKm:
        distance === null || Number.isNaN(distance)
          ? Math.round(input.route.measurePlannedDistanceKm() * 100) / 100
          : Math.round(distance * 100) / 100,
      waypoints: input.route.toPlannedPayload(),
    };
  }

  /** Main flow step 2: assign a patrol route that the ranger will see. */
  async assignPatrol(input: PatrolAssignmentInput): Promise<string> {
    const errors = this.validateAssignment(input);
    if (Object.keys(errors).length) throw new AssignmentValidationError(errors);
    return rpcAssignPatrol(this.toWrite(input));
  }

  /** Alternative flow 2a: update the route before the patrol starts. */
  async updatePatrolRoute(patrol: Patrol, input: PatrolAssignmentInput): Promise<string> {
    const errors = this.validateAssignment(input, { editing: true, originalScheduledFor: patrol.scheduledFor });
    if (Object.keys(errors).length) throw new AssignmentValidationError(errors);
    return rpcUpdatePatrolRoute(patrol.patrolId, this.toWrite(input));
  }

  async deletePatrol(patrolId: string): Promise<void> {
    await deleteAssignedPatrol(patrolId);
  }

  /** Step 9 / exception 14a: supervisor reviews a completed or incomplete patrol. */
  async reviewPatrol(patrolId: string, note: string): Promise<void> {
    await rpcReviewPatrol(patrolId, note.trim());
  }

  async getPatrols(query: PatrolQuery = {}): Promise<Patrol[]> {
    return (await fetchPatrols(this.scope, query)).map((r) => Patrol.fromRow(r));
  }

  /** Patrols for the operations dashboard, with the last known position of active patrols. */
  async getOperationsPatrols(): Promise<Patrol[]> {
    const rows = await attachLastPositions(await fetchPatrols(this.scope, { limit: 300 }));
    return rows.map((r) => Patrol.fromRow(r));
  }

  /** Step 9: completed patrol with its route, waypoints and coverage. */
  async viewPatrolCoverage(patrolId: string): Promise<Patrol> {
    return Patrol.fromRow(await fetchPatrol(patrolId));
  }

  async getFinishedPatrols(days: CoverageRange): Promise<Patrol[]> {
    return this.getPatrols({
      statuses: ['Completed', 'Incomplete'],
      endedSince: rangeStart(days).toISOString(),
      limit: 1000,
    });
  }

  viewAnalysis(
    finished: Patrol[],
    zones: Zone[],
    days: CoverageRange,
    zoneName: (id: string | null) => string | null,
  ): CoverageAnalysis {
    const parkZones = this.parkId ? zones.filter((z) => z.park_id === this.parkId) : zones;
    return analyseCoverage(finished, parkZones, days, zoneName);
  }
}
