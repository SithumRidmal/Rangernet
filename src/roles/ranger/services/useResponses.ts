import { useCallback } from 'react';
import { useProfile } from '@shared/auth/AuthProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { ResponseAssignment } from '../models/ResponseAssignment';
import { rangerRepository } from './rangerRepository';
import { pendingResponseUpdates, type PendingResponseUpdate } from './responseService';
import { useReloadable, type Fetched } from './useReloadable';

export type ResponseListItem = { assignment: ResponseAssignment; pending: PendingResponseUpdate | null };

export function useMyResponses() {
  const profile = useProfile();
  const { version } = useSync();
  const { tick } = useNotifications();
  const fetcher = useCallback(async (): Promise<Fetched<ResponseListItem[]>> => {
    const [res, pending] = await Promise.all([rangerRepository.myAssignments(profile.id), pendingResponseUpdates()]);
    const data = res.data.map((row) => {
      const p = pending.get(row.assignment_id) ?? null;
      return { assignment: new ResponseAssignment(row, p?.status), pending: p };
    });
    return { data, fromCache: res.fromCache };
  }, [profile.id]);

  const { data: items, loading, error, fromCache, reload } = useReloadable(fetcher, [], `${version}:${tick}`);
  return { items, loading, error, fromCache, reload };
}
