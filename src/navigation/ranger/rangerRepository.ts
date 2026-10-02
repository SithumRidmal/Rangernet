import { supabase } from '@shared/lib/supabase';
import { cacheGet, cacheSet } from '@shared/sync/localDb';
import { unwrap } from '@shared/utils/errors';
import type { PatrolRow } from '@features/uc02-patrol-tracking/ranger/models/Patrol';
import type { AssignmentRow } from '@features/uc04-human-wildlife-conflict/ranger-response/models/ResponseAssignment';

export type IncidentRow = {
  incident_id: string;
  incident_no: number;
  ranger_id: string;
  type_id: number;
  park_id: string | null;
  zone_id: string | null;
  description: string;
  reported_at: string;
  status: 'Reported' | 'Under Review' | 'Resolved';
  is_offline: boolean;
  synced_at: string | null;
  created_at: string;
  type: { type_name: string } | null;
  location: { latitude: number; longitude: number; manually_marked: boolean } | null;
  photos: { photo_id: string; photo_path: string; captured_at: string }[] | null;
};

export type Loaded<T> = { data: T; fromCache: boolean };

const INCIDENT_SELECT =
  '*, type:incident_types(type_name), location:locations(latitude, longitude, manually_marked), photos:incident_photos(photo_id, photo_path, captured_at)';
const PATROL_SELECT = '*, route:patrol_routes(*, waypoints(*))';
const ASSIGNMENT_SELECT =
  '*, report:community_reports(report_id, report_no, type_id, description, reported_at, status, severity, is_high_risk, report_channel, sms_sender, member_id, location:locations(latitude, longitude, manually_marked, location_description), photos:report_photos(photo_id, photo_path, captured_at)), officer:profiles!response_assignments_officer_id_fkey(full_name, contact_number)';

/** Fetches from Supabase and keeps a copy on the device so rangers can work in the field without signal. */
async function cached<T>(key: string, fetcher: () => Promise<T>): Promise<Loaded<T>> {
  try {
    const data = await fetcher();
    await cacheSet(key, data).catch(() => undefined);
    return { data, fromCache: false };
  } catch (e) {
    const copy = await cacheGet<T>(key);
    if (copy !== null) return { data: copy, fromCache: true };
    throw e;
  }
}

export const rangerRepository = {
  myIncidents(rangerId: string) {
    return cached(`ranger:${rangerId}:incidents`, async () =>
      unwrap<IncidentRow[]>(
        await supabase.from('incidents').select(INCIDENT_SELECT).eq('ranger_id', rangerId).order('reported_at', { ascending: false }).limit(200),
      ),
    );
  },

  async incident(rangerId: string, incidentId: string): Promise<Loaded<IncidentRow | null>> {
    try {
      const row = unwrap<IncidentRow | null>(
        await supabase.from('incidents').select(INCIDENT_SELECT).eq('incident_id', incidentId).maybeSingle(),
      );
      return { data: row, fromCache: false };
    } catch (e) {
      const list = await cacheGet<IncidentRow[]>(`ranger:${rangerId}:incidents`);
      const hit = list?.find((i) => i.incident_id === incidentId);
      if (hit) return { data: hit, fromCache: true };
      throw e;
    }
  },

  myPatrols(rangerId: string) {
    return cached(`ranger:${rangerId}:patrols`, async () =>
      unwrap<PatrolRow[]>(
        await supabase
          .from('patrols')
          .select(PATROL_SELECT)
          .eq('ranger_id', rangerId)
          .order('scheduled_for', { ascending: true, nullsFirst: false })
          .limit(200),
      ),
    );
  },

  async patrol(rangerId: string, patrolId: string): Promise<Loaded<PatrolRow | null>> {
    try {
      const row = unwrap<PatrolRow | null>(await supabase.from('patrols').select(PATROL_SELECT).eq('patrol_id', patrolId).maybeSingle());
      return { data: row, fromCache: false };
    } catch (e) {
      const list = await cacheGet<PatrolRow[]>(`ranger:${rangerId}:patrols`);
      const hit = list?.find((p) => p.patrol_id === patrolId);
      if (hit) return { data: hit, fromCache: true };
      throw e;
    }
  },

  myAssignments(rangerId: string) {
    return cached(`ranger:${rangerId}:assignments`, async () =>
      unwrap<AssignmentRow[]>(
        await supabase
          .from('response_assignments')
          .select(ASSIGNMENT_SELECT)
          .eq('ranger_id', rangerId)
          .order('assigned_at', { ascending: false })
          .limit(100),
      ),
    );
  },

  async assignment(rangerId: string, assignmentId: string): Promise<Loaded<AssignmentRow | null>> {
    try {
      const row = unwrap<AssignmentRow | null>(
        await supabase.from('response_assignments').select(ASSIGNMENT_SELECT).eq('assignment_id', assignmentId).maybeSingle(),
      );
      return { data: row, fromCache: false };
    } catch (e) {
      const list = await cacheGet<AssignmentRow[]>(`ranger:${rangerId}:assignments`);
      const hit = list?.find((a) => a.assignment_id === assignmentId);
      if (hit) return { data: hit, fromCache: true };
      throw e;
    }
  },

  async memberContact(memberId: string): Promise<{ full_name: string; contact_number: string | null; village: string | null } | null> {
    const { data } = await supabase.from('profiles').select('full_name, contact_number, village').eq('id', memberId).maybeSingle();
    return (data as { full_name: string; contact_number: string | null; village: string | null } | null) ?? null;
  },
};
