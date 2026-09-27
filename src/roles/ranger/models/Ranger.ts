import type { Profile } from '@shared/types';
import { Incident } from './Incident';
import type { IncidentType } from './IncidentType';

/** Ranger (class diagram): rangerId, name; reportIncident(). 1 -> 0..* Incident, 1 -> 0..* Patrol. */
export class Ranger {
  constructor(
    readonly rangerId: string,
    readonly name: string,
    readonly employeeId: string | null = null,
    readonly assignedArea: string | null = null,
  ) {}

  static fromProfile(profile: Profile): Ranger {
    return new Ranger(profile.id, profile.full_name, profile.employee_id, profile.assigned_area);
  }

  /** reportIncident(): starts UC-01 by creating a new incident of the selected type. */
  reportIncident(type: IncidentType): Incident {
    return Incident.createIncident(type);
  }
}
