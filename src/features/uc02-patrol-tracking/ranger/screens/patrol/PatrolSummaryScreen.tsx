import React, { useEffect, useState } from 'react';
import { CloudOffIcon, FlagIcon } from 'lucide-react-native';
import { SuccessScreen } from '@shared/components';
import { useSync } from '@shared/sync/SyncProvider';
import { formatDuration, formatKm, formatTime } from '@shared/utils/format';
import { patrolSessionStore } from '../../services/patrolSessionStore';
import type { PatrolCompletion } from '@navigation/ranger/CentralOperationsSystem';
import { usePatrolSyncState } from '../../services/usePatrols';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

/** UC-02 step 8: the system synchronizes and confirms (17a: kept pending and retried when the network returns). */
export function PatrolSummaryScreen({ navigation, route }: RangerScreenProps<'PatrolSummary'>) {
  const s = route.params.summary;
  const sync = usePatrolSyncState(s.patrolId);
  const { version } = useSync();
  const [server, setServer] = useState<PatrolCompletion | null>(null);

  useEffect(() => {
    patrolSessionStore.get(s.patrolId).then((session) => setServer(session?.result ?? null)).catch(() => undefined);
  }, [s.patrolId, version]);

  const synced = !sync.pending;
  const distance = server?.distance_covered ?? s.distanceKm;
  const coverage = server ? server.coverage_percent : s.coveragePercent;
  const incomplete = s.status === 'Incomplete';

  return (
    <SuccessScreen
      tone={synced && !incomplete ? 'ok' : 'warn'}
      icon={!synced ? CloudOffIcon : incomplete ? FlagIcon : undefined}
      title={
        !synced
          ? incomplete
            ? 'Patrol recorded as Incomplete'
            : 'Patrol saved on this device'
          : incomplete
            ? 'Patrol recorded as Incomplete'
            : 'Patrol completed'
      }
      message={
        sync.failed
          ? `Synchronization failed: ${sync.error ?? 'unknown error'}. Open the Sync Center to retry.`
          : !synced
            ? 'The patrol data is kept pending on this device and will be synchronized automatically when the network returns.'
            : incomplete
              ? 'The recorded route and coverage were synchronized. Your supervisor will review this patrol.'
              : 'Route, waypoints and coverage were synchronized and are now visible to your supervisor on the operations dashboard.'
      }
      meta={[
        { label: 'Patrol', value: `${s.code}` },
        { label: 'Time', value: `${formatTime(s.startTime)} – ${formatTime(s.endTime)} (${formatDuration(Date.parse(s.endTime) - Date.parse(s.startTime))})` },
        { label: 'Distance covered', value: formatKm(distance, 2) },
        { label: 'Coverage', value: coverage === null || coverage === undefined ? '—' : `${coverage}%` },
        { label: 'Waypoints', value: s.plannedCount ? `${s.visitedCount}/${s.plannedCount} visited · ${s.markedCount} marked` : `${s.markedCount} marked` },
        { label: 'Sync', value: sync.failed ? 'Failed' : synced ? 'Synced' : 'Pending Sync' },
        ...(s.reason ? [{ label: 'Reason', value: s.reason }] : []),
      ]}
      primaryLabel={sync.pending ? 'Open Sync Center' : 'Back to Home'}
      onPrimary={() => (sync.pending ? navigation.navigate('SyncCenter') : navigation.popToTop())}
      secondaryLabel="View patrol"
      onSecondary={() => navigation.replace('PatrolDetail', { patrolId: s.patrolId })}
    />
  );
}
