import { supabase } from '@shared/lib/supabase';
import { ServiceError, unwrap } from '@shared/utils/errors';
import type { PatrolStatus, RangerPatrolStat, RangerRow } from './rows';

const RANGER_COLUMNS = 'id, full_name, employee_id, email, contact_number, park_id, is_active';

export type RangerOverview = RangerRow & {
  onPatrol: boolean;
  assignedCount: number;
  completedCount: number;
  incompleteCount: number;
};

/** Rangers of the supervisor's park (and rangers not yet linked to a park). */
export async function fetchRangers(parkId: string | null): Promise<RangerRow[]> {
  let q = supabase.from('profiles').select(RANGER_COLUMNS).eq('role', 'ranger').eq('is_active', true);
  if (parkId) q = q.or(`park_id.eq.${parkId},park_id.is.null`);
  return ((unwrap(await q.order('full_name')) as RangerRow[]) ?? []);
}

export async function fetchRanger(rangerId: string): Promise<RangerRow> {
  const row = unwrap(
    await supabase.from('profiles').select(RANGER_COLUMNS).eq('id', rangerId).eq('role', 'ranger').maybeSingle(),
  ) as RangerRow | null;
  if (!row) throw new ServiceError('This ranger account was not found.', 'P0002');
  return row;
}

export async function fetchRangerOverview(parkId: string | null): Promise<RangerOverview[]> {
  const rangers = await fetchRangers(parkId);
  if (!rangers.length) return [];
  const stats =
    (unwrap(
      await supabase
        .from('patrols')
        .select('patrol_id, ranger_id, status')
        .in('ranger_id', rangers.map((r) => r.id)),
    ) as RangerPatrolStat[]) ?? [];
  const count = (id: string, status: PatrolStatus) => stats.filter((s) => s.ranger_id === id && s.status === status).length;
  return rangers.map((r) => ({
    ...r,
    onPatrol: count(r.id, 'In Progress') > 0,
    assignedCount: count(r.id, 'Assigned'),
    completedCount: count(r.id, 'Completed'),
    incompleteCount: count(r.id, 'Incomplete'),
  }));
}
