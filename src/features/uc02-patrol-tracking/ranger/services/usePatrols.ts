import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '@shared/auth/AuthProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { localStore } from '@shared/sync/LocalStorage';
import { Patrol, type PatrolStatus } from '../models/Patrol';
import { patrolSessionStore } from './patrolSessionStore';
import { usePatrolTracker } from './PatrolTracker';
import { rangerRepository } from '@navigation/ranger/rangerRepository';
import { useReloadable, type Fetched } from '@navigation/ranger/useReloadable';

export type PatrolSyncState = { pending: boolean; failed: boolean; error: string | null };

export type PatrolListItem = {
  patrol: Patrol;
  /** Status as known on this device (local session may be ahead of the server). */
  displayStatus: PatrolStatus;
  sync: PatrolSyncState;
};

async function patrolOutboxByGroup(ownerId: string): Promise<Map<string, PatrolSyncState>> {
  const items = await localStore.retrieveByEntity<{ ownerId: string }>('patrol').catch(() => []);
  const map = new Map<string, PatrolSyncState>();
  items
    .filter((i) => i.payload.ownerId === ownerId && i.groupKey)
    .forEach((i) => {
      const prev = map.get(i.groupKey as string) ?? { pending: false, failed: false, error: null };
      map.set(i.groupKey as string, {
        pending: true,
        failed: prev.failed || i.status === 'failed',
        error: i.status === 'failed' ? i.lastError : prev.error,
      });
    });
  return map;
}

async function localStatus(patrolId: string, activeId: string | null, server: PatrolStatus): Promise<PatrolStatus> {
  if (activeId === patrolId) return 'In Progress';
  if (server === 'Completed' || server === 'Incomplete') return server;
  const session = await patrolSessionStore.get(patrolId).catch(() => null);
  if (session?.state === 'ended' && session.finalStatus) return session.finalStatus;
  return server;
}

export function useMyPatrols() {
  const profile = useProfile();
  const { version } = useSync();
  const tracker = usePatrolTracker();
  const activeId = tracker.session?.patrolId ?? null;

  const fetcher = useCallback(async (): Promise<Fetched<PatrolListItem[]>> => {
    const [res, outbox] = await Promise.all([rangerRepository.myPatrols(profile.id), patrolOutboxByGroup(profile.id)]);
    const list = await Promise.all(
      res.data.map(async (row) => {
        const patrol = Patrol.fromRow(row);
        return {
          patrol,
          displayStatus: await localStatus(patrol.patrolId, activeId, patrol.status),
          sync: outbox.get(patrol.patrolId) ?? { pending: false, failed: false, error: null },
        };
      }),
    );
    return { data: list, fromCache: res.fromCache };
  }, [profile.id, activeId]);

  const { data: items, loading, error, fromCache, reload } = useReloadable(fetcher, [], version);
  return { items, loading, error, fromCache, reload };
}

export function usePatrolSyncState(patrolId: string): PatrolSyncState {
  const profile = useProfile();
  const { version } = useSync();
  const [state, setState] = useState<PatrolSyncState>({ pending: true, failed: false, error: null });
  useEffect(() => {
    let alive = true;
    patrolOutboxByGroup(profile.id).then((m) => {
      if (alive) setState(m.get(patrolId) ?? { pending: false, failed: false, error: null });
    });
    return () => {
      alive = false;
    };
  }, [patrolId, profile.id, version]);
  return state;
}
