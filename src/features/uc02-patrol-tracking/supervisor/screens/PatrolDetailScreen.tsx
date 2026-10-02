import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  ActivityIcon,
  ClipboardCheckIcon,
  CloudOffIcon,
  FlagIcon,
  PencilIcon,
  RouteIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BellButton,
  BottomSheet,
  Button,
  Card,
  Field,
  Input,
  KeyValue,
  Modal,
  Notice,
  OfflineBanner,
  ProgressRing,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  Timeline,
  useToast,
  type TimelineEntry,
} from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { formatDateTime, formatDuration, formatKm, formatTime, relativeTime } from '@shared/utils/format';
import type { Patrol } from '../models';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData } from '../hooks/useRemoteData';
import { useAutoReload } from '../hooks/useAutoReload';
import { usePatrolRealtime } from '../hooks/usePatrolRealtime';
import { patrolCodec } from '../hooks/codecs';
import { RemoteStatus } from '../components/RemoteStatus';
import { PatrolRouteMap } from '../components/PatrolRouteMap';
import { WaypointTimeline } from '../components/WaypointTimeline';
import type { SupervisorScreenProps } from '../navigation/types';

function historyOf(p: Patrol): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    { label: 'Patrol assigned', detail: p.getRangerName(), time: formatDateTime(p.createdAt), done: true },
  ];
  if (p.routeUpdatedAt) {
    entries.push({ label: 'Route updated before start', detail: 'Ranger notified', time: formatDateTime(p.routeUpdatedAt), done: true, tone: 'warn' });
  }
  entries.push({
    label: 'Patrol started',
    detail: p.startTime ? 'Tracking session created' : 'Waiting for the ranger to start',
    time: p.startTime ? formatDateTime(p.startTime) : '—',
    done: !!p.startTime,
  });
  if (p.status === 'Incomplete') {
    entries.push({ label: 'Stopped early – Incomplete', detail: p.incompleteReason ?? 'No reason given', time: formatDateTime(p.endTime), done: true, tone: 'critical' });
  } else {
    entries.push({
      label: 'Patrol completed',
      detail: p.status === 'Completed' ? 'Route and coverage calculated' : undefined,
      time: p.endTime ? formatDateTime(p.endTime) : '—',
      done: p.status === 'Completed',
      tone: 'ok',
    });
  }
  if (p.isFinished()) {
    entries.push({
      label: 'Reviewed by supervisor',
      detail: p.reviewedAt ? (p.supervisorNote ?? 'No note') : 'Awaiting your review',
      time: p.reviewedAt ? formatDateTime(p.reviewedAt) : '—',
      done: p.isReviewed(),
    });
  }
  return entries;
}

export function PatrolDetailScreen({ navigation, route }: SupervisorScreenProps<'PatrolDetail'>) {
  const { patrolId } = route.params;
  const supervisor = useSupervisor();
  const toast = useToast();
  const { online } = useSync();
  const { zoneName, parkName } = useLookups();

  const load = useCallback(() => supervisor.viewPatrolCoverage(patrolId), [supervisor, patrolId]);
  const remote = useRemoteData(`sup:${supervisor.supervisorId}:patrol:${patrolId}`, load, patrolCodec);
  useAutoReload(remote.reload);
  usePatrolRealtime(remote.reload, remote.data?.status === 'In Progress' ? 30000 : undefined);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const patrol = remote.data;

  const submitReview = async () => {
    if (!patrol) return;
    setReviewing(true);
    setReviewError(null);
    try {
      await supervisor.reviewPatrol(patrol.patrolId, note);
      setReviewOpen(false);
      setNote('');
      toast.show(`${patrol.getCode()} marked as reviewed`, 'ok');
      await remote.reload();
    } catch (e) {
      setReviewError(getErrorMessage(e));
    } finally {
      setReviewing(false);
    }
  };

  const confirmDelete = async () => {
    if (!patrol) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await supervisor.deletePatrol(patrol.patrolId);
      setDeleteOpen(false);
      toast.show(`${patrol.getCode()} deleted`, 'warn');
      navigation.goBack();
    } catch (e) {
      setDeleteError(getErrorMessage(e));
      remote.reload();
    } finally {
      setDeleting(false);
    }
  };

  const zoneLabel = patrol ? (zoneName(patrol.zoneId) ?? parkName(patrol.parkId)) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title={patrol ? patrol.getCode() : 'Patrol'} subtitle={zoneLabel} right={<BellButton />} />
      <OfflineBanner />
      <Screen onRefresh={remote.refresh} refreshing={remote.refreshing}>
        <RemoteStatus remote={remote} loadingLabel="Loading patrol…">
          {(p) => <PatrolBody patrol={p} />}
        </RemoteStatus>
      </Screen>

      {patrol && (patrol.needsReview() || patrol.canEditRoute()) ? (
        <StickyFooter>
          {!online ? (
            <AppText size={12} color={colors.warnText} align="center">
              Connect to the network to {patrol.canEditRoute() ? 'edit or delete this patrol' : 'record your review'}.
            </AppText>
          ) : null}
          {patrol.needsReview() ? (
            <Button full size="lg" icon={ClipboardCheckIcon} disabled={!online} onPress={() => setReviewOpen(true)}>
              Mark as reviewed
            </Button>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button variant="outline" icon={Trash2Icon} disabled={!online} onPress={() => setDeleteOpen(true)} style={{ flex: 1 }}>
                Delete
              </Button>
              <Button
                icon={PencilIcon}
                disabled={!online}
                onPress={() => navigation.navigate('PatrolForm', { patrolId: patrol.patrolId })}
                style={{ flex: 2 }}
              >
                Edit route
              </Button>
            </View>
          )}
        </StickyFooter>
      ) : null}

      <BottomSheet open={reviewOpen} onClose={() => setReviewOpen(false)} title="Review patrol">
        {patrol ? (
          <View style={{ gap: 14, paddingBottom: 12 }}>
            <AppText size={13} color={colors.muted} lineHeight={19}>
              {patrol.status === 'Incomplete'
                ? `${patrol.getRangerName()} stopped ${patrol.getCode()} early${patrol.incompleteReason ? `: “${patrol.incompleteReason}”` : ''}. Record your review of the incomplete patrol.`
                : `Confirm you have checked the route, waypoints and ${patrol.getRoute().coveragePercent ?? 0}% coverage of ${patrol.getCode()}.`}
            </AppText>
            <Field label="Supervisor note" hint="Optional – visible on the patrol record.">
              <Input value={note} onChangeText={setNote} multiline placeholder="Follow-up actions, comments for the ranger…" maxLength={1000} />
            </Field>
            {reviewError ? <Notice tone="critical" icon={TriangleAlertIcon} message={reviewError} /> : null}
            {!online ? <Notice tone="warn" icon={CloudOffIcon} message="You are offline. Reviews are saved on the server – reconnect to continue." /> : null}
            <Button full size="lg" loading={reviewing} disabled={!online} onPress={submitReview}>
              Confirm review
            </Button>
          </View>
        ) : null}
      </BottomSheet>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        icon={Trash2Icon}
        tone="critical"
        title={`Delete ${patrol?.getCode() ?? 'patrol'}?`}
        description="The patrol has not started yet. It will be removed from the ranger’s assigned patrols together with its planned route."
        actions={
          <>
            {deleteError ? <Notice tone="critical" icon={TriangleAlertIcon} message={deleteError} /> : null}
            <Button full variant="danger" loading={deleting} disabled={!online} onPress={confirmDelete}>
              Delete patrol
            </Button>
            <Button full variant="ghost" onPress={() => setDeleteOpen(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </View>
  );
}

function PatrolBody({ patrol }: { patrol: Patrol }) {
  const route = patrol.getRoute();
  const planned = route.getPlannedWaypoints();
  const track = route.getTrack();
  const marked = route.getMarkedWaypoints();
  const last = patrol.getLastKnownPosition();
  const duration = patrol.getDurationMs();
  const coverage = route.coveragePercent;

  return (
    <>
      <Card style={{ overflow: 'hidden' }}>
        <PatrolRouteMap patrol={patrol} />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <StatusBadge status={patrol.status} />
        {patrol.isFinished() ? (
          patrol.isReviewed() ? <StatusBadge status="Reviewed" /> : <StatusBadge status="Awaiting review" dot={false} />
        ) : null}
        {patrol.status === 'Assigned' && patrol.routeUpdatedAt ? <StatusBadge status="Route updated" dot={false} /> : null}
      </View>
      <AppText size={17} weight="semibold" style={{ marginTop: 8 }}>
        {patrol.title}
      </AppText>

      {patrol.status === 'Incomplete' ? (
        <Notice
          tone="warn"
          icon={FlagIcon}
          title="Stopped early – marked Incomplete"
          message={patrol.incompleteReason ? `Ranger’s reason: ${patrol.incompleteReason}` : 'The ranger did not give a reason.'}
          style={{ marginTop: 12 }}
        />
      ) : null}
      {patrol.status === 'In Progress' ? (
        <Notice
          tone="info"
          icon={ActivityIcon}
          title="Patrol in progress"
          message={
            last
              ? `Last position ${relativeTime(last.timestamp)} · ${track.length} point${track.length === 1 ? '' : 's'} recorded. Positions arrive as the ranger’s device syncs.`
              : 'No position has reached the server yet. The ranger may be offline – points sync when a connection returns.'
          }
          style={{ marginTop: 12 }}
        />
      ) : null}
      {patrol.status === 'Assigned' ? (
        <Notice
          tone="info"
          icon={RouteIcon}
          message={
            patrol.routeUpdatedAt
              ? `Route updated ${relativeTime(patrol.routeUpdatedAt)}. The ranger sees “Route updated” until they start.`
              : 'The ranger can see this route on their assigned patrols. You can still edit it until they start.'
          }
          style={{ marginTop: 12 }}
        />
      ) : null}

      <Card style={{ marginTop: 12, padding: 16 }}>
        <KeyValue
          items={[
            { label: 'Ranger', value: `${patrol.getRangerName()}${patrol.ranger?.employee_id ? ` · ${patrol.ranger.employee_id}` : ''}` },
            { label: 'Scheduled', value: formatDateTime(patrol.scheduledFor) },
            { label: 'Start', value: formatDateTime(patrol.startTime) },
            { label: 'End', value: formatDateTime(patrol.endTime) },
            { label: 'Duration', value: duration !== null ? formatDuration(duration) : '—' },
            { label: 'Distance covered', value: patrol.startTime ? formatKm(route.distanceCovered, 2) : '—' },
            { label: 'Planned distance', value: formatKm(route.plannedDistanceKm) },
            { label: 'Coverage', value: coverage !== null ? `${coverage}%` : '—' },
          ]}
        />
      </Card>

      {patrol.isFinished() ? (
        <Card style={{ marginTop: 12, padding: 16 }}>
          <ProgressRing
            value={coverage ?? 0}
            label={
              coverage === null
                ? 'Coverage could not be calculated (no planned waypoints or distance).'
                : planned.length
                  ? `of ${planned.length} planned waypoint${planned.length === 1 ? '' : 's'} visited · ${formatKm(route.distanceCovered, 2)} covered`
                  : `of the planned distance covered · ${formatKm(route.distanceCovered, 2)}`
            }
          />
        </Card>
      ) : null}

      {patrol.instructions ? (
        <View style={{ marginTop: 20 }}>
          <SectionHeader title="Instructions" />
          <Card style={{ padding: 16 }}>
            <AppText size={14} lineHeight={21}>
              {patrol.instructions}
            </AppText>
          </Card>
        </View>
      ) : null}

      {patrol.status !== 'Assigned' ? (
        <View style={{ marginTop: 20 }}>
          <SectionHeader title={`Marked waypoints (${marked.length})`} />
          <Card style={{ padding: 16 }}>
            {marked.length ? (
              <WaypointTimeline waypoints={marked} />
            ) : (
              <AppText size={13} color={colors.muted}>
                No waypoints were marked on this patrol.
              </AppText>
            )}
            <AppText size={12} color={colors.muted} style={{ marginTop: 12 }}>
              {track.length} position{track.length === 1 ? '' : 's'} recorded
              {track.length ? ` · ${formatTime(track[0].timestamp)} – ${formatTime(track[track.length - 1].timestamp)}` : ''}
            </AppText>
          </Card>
        </View>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <SectionHeader title={`Planned route (${planned.length})`} />
        <Card style={{ padding: 16 }}>
          {planned.length ? (
            <WaypointTimeline waypoints={planned} planned />
          ) : (
            <AppText size={13} color={colors.muted}>
              No planned waypoints were set for this patrol.
            </AppText>
          )}
        </Card>
      </View>

      <View style={{ marginTop: 20, marginBottom: 8 }}>
        <SectionHeader title="Patrol timeline" />
        <Card style={{ padding: 16 }}>
          <Timeline entries={historyOf(patrol)} />
        </Card>
      </View>
    </>
  );
}
