/** The five actors of the RangerNet use case diagram. */
export type AppRole =
  | 'ranger'
  | 'park_supervisor'
  | 'community_member'
  | 'community_liaison_officer'
  | 'park_manager';

export const ROLE_LABELS: Record<AppRole, string> = {
  ranger: 'Ranger',
  park_supervisor: 'Park Supervisor',
  community_member: 'Community Member',
  community_liaison_officer: 'Community Liaison Officer',
  park_manager: 'Park Manager',
};

export const STAFF_ROLES: AppRole[] = ['ranger', 'park_supervisor', 'community_liaison_officer', 'park_manager'];

export interface Profile {
  id: string;
  role: AppRole;
  full_name: string;
  email: string | null;
  employee_id: string | null;
  contact_number: string | null;
  village: string | null;
  assigned_area: string | null;
  park_id: string | null;
  is_active: boolean;
}

export interface LookupType {
  type_id: number;
  type_name: string;
}

export interface Park {
  park_id: string;
  code: string;
  name: string;
  region: string | null;
  center_lat: number;
  center_lng: number;
}

export interface Zone {
  zone_id: string;
  park_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}
