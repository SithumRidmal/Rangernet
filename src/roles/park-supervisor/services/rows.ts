export type PatrolStatus = 'Assigned' | 'In Progress' | 'Completed' | 'Incomplete';
export const PATROL_STATUSES: readonly PatrolStatus[] = ['Assigned', 'In Progress', 'Completed', 'Incomplete'];

export type WaypointType = 'PLANNED' | 'TRACK' | 'MARKED';

export interface WaypointRow {
  waypoint_id: string;
  route_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  manually_marked: boolean;
  waypoint_type: WaypointType;
  sequence_no: number | null;
  note: string | null;
}

export interface RouteRow {
  route_id: string;
  patrol_id: string;
  planned_distance_km: number | string | null;
  distance_covered: number | string | null;
  coverage_percent: number | string | null;
  waypoints?: WaypointRow[] | null;
}

export interface PersonRef {
  id: string;
  full_name: string;
  employee_id: string | null;
}

export interface PatrolRow {
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
  created_at: string;
  /** PostgREST returns a one-to-one embed as an object, older versions as an array. */
  route: RouteRow | RouteRow[] | null;
  ranger: PersonRef | null;
}

export interface RangerRow {
  id: string;
  full_name: string;
  employee_id: string | null;
  email: string | null;
  contact_number: string | null;
  park_id: string | null;
  is_active: boolean;
}

export interface RangerPatrolStat {
  patrol_id: string;
  ranger_id: string;
  status: PatrolStatus;
}

export interface IncidentLocationRow {
  location_id: string;
  latitude: number | null;
  longitude: number | null;
  manually_marked: boolean;
  location_description: string | null;
}

export interface IncidentPhotoRow {
  photo_id: string;
  photo_path: string;
  captured_at: string;
}

export interface IncidentRow {
  incident_id: string;
  incident_no: number;
  ranger_id: string;
  type_id: number;
  park_id: string | null;
  zone_id: string | null;
  description: string;
  reported_at: string;
  status: string;
  is_offline: boolean;
  synced_at: string;
  type: { type_name: string } | null;
  location: IncidentLocationRow | null;
  ranger: PersonRef | null;
  photos: IncidentPhotoRow[] | null;
}
