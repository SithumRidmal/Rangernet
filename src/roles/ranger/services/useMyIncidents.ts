import { useCallback } from 'react';
import { useProfile } from '@shared/auth/AuthProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { localStore, type OutboxItem } from '@shared/sync/LocalStorage';
import { getErrorMessage } from '@shared/utils/errors';
import { formatCode } from '@shared/utils/format';
import type { IncidentPayload } from './CentralOperationsSystem';
import { rangerRepository, type IncidentRow } from './rangerRepository';
import { useReloadable, type Fetched } from './useReloadable';

export type IncidentListItem = {
  key: string;
  incidentId: string;
  code: string;
  typeName: string;
  description: string;
  status: string;
  sync: 'Synced' | 'Pending Sync' | 'Failed';
  reportedAt: string;
  manuallyMarked: boolean;
  thumbUri: string | null;
  lastError: string | null;
};

const fromServer = (r: IncidentRow): IncidentListItem => ({
  key: r.incident_id,
  incidentId: r.incident_id,
  code: formatCode('INC', r.incident_no),
  typeName: r.type?.type_name ?? 'Incident',
  description: r.description,
  status: r.status,
  sync: 'Synced',
  reportedAt: r.reported_at,
  manuallyMarked: r.location?.manually_marked ?? false,
  thumbUri: null,
  lastError: null,
});

const fromLocal = (i: OutboxItem<IncidentPayload>): IncidentListItem => ({
  key: `local-${i.id}`,
  incidentId: i.payload.incidentId,
  code: 'INC-····',
  typeName: i.payload.typeName,
  description: i.payload.description,
  status: 'Reported',
  sync: i.status === 'failed' ? 'Failed' : 'Pending Sync',
  reportedAt: i.payload.reportedAt,
  manuallyMarked: i.payload.manuallyMarked,
  thumbUri: i.payload.photos[0]?.localUri ?? null,
  lastError: i.lastError,
});

/** Server incidents merged with incidents still waiting in LocalStorage. */
export function useMyIncidents() {
  const profile = useProfile();
  const { version } = useSync();

  const fetcher = useCallback(async (): Promise<Fetched<IncidentListItem[]>> => {
    const local = (await localStore.retrieveIncident<IncidentPayload>().catch(() => []))
      .filter((i) => i.payload.ownerId === profile.id)
      .map(fromLocal)
      .reverse();
    try {
      const res = await rangerRepository.myIncidents(profile.id);
      const localIds = new Set(local.map((l) => l.incidentId));
      const server = res.data.filter((r) => !localIds.has(r.incident_id)).map(fromServer);
      return { data: [...local, ...server], fromCache: res.fromCache };
    } catch (e) {
      return { data: local, fromCache: false, error: getErrorMessage(e) };
    }
  }, [profile.id]);

  const { data: items, loading, error, fromCache, reload } = useReloadable(fetcher, [], version);
  return { items, loading, error, fromCache, reload };
}
