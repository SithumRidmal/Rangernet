import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { CloudOffIcon, FlagIcon, InfoIcon, PlayIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  KeyValue,
  LoadingBlock,
  MapLegend,
  MapPanel,
  Modal,
  Notice,
  OfflineBanner,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  Timeline,
  type MapLine,
  type MapPoint,
} from '@shared/components';
import { colors } from '@shared/theme';
import { useProfile } from '@shared/auth/AuthProvider';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { getErrorMessage } from '@shared/utils/errors';
import { formatDateTime, formatDuration, formatKm, formatTime } from '@shared/utils/format';
import { Patrol } from '../../models/Patrol';
import type { Waypoint } from '../../models/Waypoint';
import { rangerRepository } from '@navigation/ranger/rangerRepository';
import { useReloadable, type Fetched } from '@navigation/ranger/useReloadable';
import { patrolSessionStore, type PatrolSession } from '../../services/patrolSessionStore';
import { patrolTracker, usePatrolTracker } from '../../services/PatrolTracker';
import { usePatrolSyncState } from '../../services/usePatrols';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

/** UC-02 step 3: route, waypoints and patrol information (2a: route updated by the supervisor). */
type Loaded = { patrol: Patrol | null; session: PatrolSession | null; localPoints: Waypoint[] };

export function PatrolDetailScreen({ navigation, route }: RangerScreenProps<'PatrolDetail'>) {
  const { patrolId } = route.params;
  const profile = useProfile();
  const { zoneName, parkName } = useLookups();
  const { version } = useSync();
  const tracker = usePatrolTracker();
  const sync = usePatrolSyncState(patrolId);
  const [confirmStart, setConfirmStart] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const fetcher = useCallback(async (): Promise<Fetched<Loaded | null>> => {
    const res = await rangerRepository.patrol(profile.id, patrolId);
    const session = await patrolSessionStore.get(patrolId).catch(() => null);
    const localPoints = session ? await patrolSessionStore.points(patrolId) : [];
    return { data: { patrol: res.data ? Patrol.fromRow(res.data) : null, session, localPoints }, fromCache: res.fromCache };
  }, [patrolId, profile.id]);
  const { data, fromCache, error, loading, reload: load } = useReloadable(fetcher, null, version);
  const patrol = data?.patrol ?? null;
  const session = data?.session ?? null;
  const localPoints = data?.localPoints ?? [];

  if (data && !patrol) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Patrol" />
        <EmptyState icon={SearchXIcon} title="Patrol not found" message="This patrol may have been removed by your supervisor." />
      </View>
    );
  }
  if (!patrol) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Patrol" />
        {error ? (
          <EmptyState icon={TriangleAlertIcon} tone="critical" title="Could not load the patrol" message={error} actionLabel="Retry" onAction={load} />
        ) : (
          <LoadingBlock label="Loading route details…" />
        )}
      </View>
    );
  }

  const isActiveHere = tracker.session?.patrolId === patrolId;
  const otherActive = !!tracker.session && !isActiveHere;
  const localEnded = session?.state === 'ended' ? session : null;
  const status = isActiveHere ? 'In Progress' : localEnded && (patrol.status === 'Assigned' || patrol.status === 'In Progress') ? (localEnded.finalStatus ?? patrol.status) : patrol.status;
  const finished = status === 'Completed' || status === 'Incomplete';
  const planned = patrol.route.plannedWaypoints();
  const serverTrack = patrol.route.getRoute();
  const track = serverTrack.length >= localPoints.length ? serverTrack : localPoints;
  const marked = track.filter((w) => w.waypointType === 'MARKED');
  const startTime = patrol.startTime ?? session?.startTime ?? null;
  const endTime = patrol.endTime ?? localEnded?.endTime ?? null;

  const lines: MapLine[] = [];
  if (planned.length > 1) lines.push({ id: 'planned', coordinates: planned.map((w) => ({ latitude: w.latitude, longitude: w.longitude })), color: colors.forest700, dashed: true, width: 3 });
  if (track.length > 1) lines.push({ id: 'track', coordinates: track.map((w) => ({ latitude: w.latitude, longitude: w.longitude })), color: colors.forest400, width: 4 });
  const markers: MapPoint[] = [
    ...planned.map((w, i) => ({ id: `p-${w.waypointId}`, latitude: w.latitude, longitude: w.longitude, kind: 'planned' as const, label: w.note ?? `Waypoint ${i + 1}` })),
    ...marked.map((w) => ({ id: `m-${w.waypointId}`, latitude: w.latitude, longitude: w.longitude, kind: 'waypoint' as const, label: w.note ?? `Marked ${formatTime(w.timestamp)}` })),
  ];

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      await patrolTracker.start(patrol, profile.id);
      setConfirmStart(false);
      navigation.navigate('ActivePatrol');
    } catch (e) {
      setStartError(getErrorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  const coverage = session?.result?.coverage_percent ?? patrol.route.coveragePercent;
  const distance = session?.result?.distance_covered ?? patrol.route.distanceCovered;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title={patrol.code} subtitle={patrol.title} />
      <OfflineBanner />
      <Screen padded={false} onRefresh={load} refreshing={loading}>
        {markers.length > 0 || lines.length > 0 ? (
          <MapPanel height={220} rounded={false} markers={markers} lines={lines}>
            <MapLegend
              style={{ position: 'absolute', left: 12, bottom: 12 }}
              items={[
                { color: colors.forest700, label: 'Planned route' },
                ...(track.length ? [{ color: colors.forest400, label: 'GPS track' }] : []),
                ...(marked.length ? [{ color: colors.info, label: 'Marked waypoint' }] : []),
              ]}
            />
          </MapPanel>
        ) : null}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <StatusBadge status={status} />
            {sync.pending ? <StatusBadge status={sync.failed ? 'Failed' : 'Pending Sync'} size="sm" /> : null}
            {patrol.reviewedAt ? <StatusBadge status="Reviewed" size="sm" /> : null}
          </View>
          <AppText size={18} weight="semibold" style={{ marginTop: 10 }}>
            {patrol.title}
          </AppText>
          <AppText size={13} color={colors.muted} style={{ marginTop: 2 }}>
            {zoneName(patrol.zoneId) ?? parkName(patrol.parkId)}
          </AppText>

          {patrol.routeUpdatedAt && status === 'Assigned' ? (
            <Notice
              tone="info"
              icon={InfoIcon}
              title="Route updated by your supervisor"
              message={`Updated ${formatDateTime(patrol.routeUpdatedAt)}. Review the new route and waypoints before starting.`}
              style={{ marginTop: 12 }}
            />
          ) : null}
          {fromCache ? <Notice tone="warn" icon={CloudOffIcon} message="Offline copy of this route." style={{ marginTop: 12 }} /> : null}
          {sync.failed ? (
            <Notice tone="critical" icon={TriangleAlertIcon} title="Synchronization failed" message={sync.error ?? 'Open the Sync Center to retry.'} action="Open Sync Center" onAction={() => navigation.navigate('SyncCenter')} style={{ marginTop: 12 }} />
          ) : null}
          {otherActive && status === 'Assigned' ? (
            <Notice tone="warn" icon={TriangleAlertIcon} message={`Finish ${tracker.patrol?.code} before starting this patrol.`} style={{ marginTop: 12 }} />
          ) : null}

          <Card style={{ padding: 16, marginTop: 12 }}>
            <KeyValue
              items={
                finished
                  ? [
                      { label: 'Start time', value: formatDateTime(startTime) },
                      { label: 'End time', value: formatDateTime(endTime) },
                      { label: 'Duration', value: startTime && endTime ? formatDuration(Date.parse(endTime) - Date.parse(startTime)) : '—' },
                      { label: 'Distance covered', value: formatKm(distance, 2) },
                      { label: 'Coverage', value: coverage === null || coverage === undefined ? '—' : `${coverage}%` },
                      { label: 'Waypoints marked', value: String(marked.length) },
                    ]
                  : [
                      { label: 'Scheduled', value: formatDateTime(patrol.scheduledFor) },
                      { label: 'Planned distance', value: patrol.route.plannedDistanceKm ? formatKm(patrol.route.plannedDistanceKm) : '—' },
                      { label: 'Route waypoints', value: String(planned.length) },
                      { label: 'Started', value: startTime ? formatDateTime(startTime) : 'Not started' },
                    ]
              }
            />
          </Card>

          {patrol.incompleteReason || localEnded?.reason ? (
            <Notice tone="warn" icon={FlagIcon} title="Stopped early" message={patrol.incompleteReason ?? localEnded?.reason ?? ''} style={{ marginTop: 12 }} />
          ) : null}
          {patrol.supervisorNote ? (
            <Notice tone="ok" icon={InfoIcon} title="Supervisor review" message={patrol.supervisorNote} style={{ marginTop: 12 }} />
          ) : null}

          {patrol.instructions ? (
            <View style={{ marginTop: 18 }}>
              <SectionHeader title="Instructions" />
              <Card style={{ padding: 14 }}>
                <AppText size={14} lineHeight={21}>
                  {patrol.instructions}
                </AppText>
              </Card>
            </View>
          ) : null}

          {planned.length > 0 ? (
            <View style={{ marginTop: 18 }}>
              <SectionHeader title={`Route waypoints (${planned.length})`} />
              <Card style={{ padding: 16 }}>
                <Timeline
                  entries={planned.map((w, i) => ({
                    label: w.note ?? `Waypoint ${i + 1}`,
                    detail: `${w.latitude.toFixed(5)}, ${w.longitude.toFixed(5)}`,
                    time: `#${i + 1}`,
                    done: finished,
                  }))}
                />
              </Card>
            </View>
          ) : null}

          {marked.length > 0 ? (
            <View style={{ marginTop: 18 }}>
              <SectionHeader title={`Marked waypoints (${marked.length})`} />
              <Card style={{ padding: 16 }}>
                <Timeline
                  entries={marked.map((w) => ({
                    label: w.note ?? 'Marked waypoint',
                    detail: `${w.latitude.toFixed(5)}, ${w.longitude.toFixed(5)}${w.manuallyMarked ? ' · manual' : ''}`,
                    time: formatTime(w.timestamp),
                    done: true,
                  }))}
                />
              </Card>
            </View>
          ) : null}
        </View>
      </Screen>

      {isActiveHere ? (
        <StickyFooter>
          <Button full size="lg" icon={PlayIcon} onPress={() => navigation.navigate('ActivePatrol')}>
            Continue Patrol
          </Button>
        </StickyFooter>
      ) : (status === 'Assigned' || (status === 'In Progress' && !localEnded)) && !otherActive ? (
        <StickyFooter>
          <Button full size="lg" icon={PlayIcon} onPress={() => setConfirmStart(true)}>
            {status === 'In Progress' ? 'Resume on this device' : 'Start Patrol'}
          </Button>
        </StickyFooter>
      ) : null}

      <Modal
        open={confirmStart}
        onClose={() => setConfirmStart(false)}
        icon={PlayIcon}
        title={`Start ${patrol.code}?`}
        description="A patrol session is created, the start time is recorded and GPS tracking begins. Keep the app open while patrolling. Data is stored on the device if there is no connection."
        actions={
          <>
            {startError ? <Notice tone="critical" icon={TriangleAlertIcon} message={startError} /> : null}
            <Button full loading={starting} onPress={() => void start()}>
              Start Patrol
            </Button>
            <Button full variant="ghost" onPress={() => setConfirmStart(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </View>
  );
}
