import { supabase } from '@shared/lib/supabase';
import { ServiceError, unwrap } from '@shared/utils/errors';
import type { IncidentRow } from './rows';

const INCIDENT_SELECT =
  '*, type:incident_types(type_name), location:locations(*), photos:incident_photos(*), ranger:profiles!incidents_ranger_id_fkey(id, full_name, employee_id)';

/** Read-only incident feed for the operations dashboard. */
export async function fetchIncidents(parkId: string | null, sinceIso: string, limit = 50): Promise<IncidentRow[]> {
  let q = supabase.from('incidents').select(INCIDENT_SELECT).gte('reported_at', sinceIso);
  if (parkId) q = q.eq('park_id', parkId);
  return ((unwrap(await q.order('reported_at', { ascending: false }).limit(limit)) as IncidentRow[]) ?? []);
}

export async function fetchIncident(incidentId: string): Promise<IncidentRow> {
  const row = unwrap(
    await supabase.from('incidents').select(INCIDENT_SELECT).eq('incident_id', incidentId).maybeSingle(),
  ) as IncidentRow | null;
  if (!row) throw new ServiceError('This incident was not found.', 'P0002');
  return row;
}
