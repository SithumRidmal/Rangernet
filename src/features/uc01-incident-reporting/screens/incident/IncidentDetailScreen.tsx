import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { CloudOffIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  KeyValue,
  LoadingBlock,
  MapPanel,
  Modal,
  Notice,
  OfflineBanner,
  PhotoThumb,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  Timeline,
  useToast,
} from '@shared/components';
import { colors } from '@shared/theme';
import { env } from '@shared/config/env';
import { useProfile } from '@shared/auth/AuthProvider';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { localStore, type OutboxItem } from '@shared/sync/LocalStorage';
import { deleteLocalPhoto } from '@shared/media/photos';
import { formatCode, formatCoord, formatDateTime } from '@shared/utils/format';
import type { IncidentPayload } from '@navigation/ranger/CentralOperationsSystem';
import { rangerRepository, type IncidentRow } from '@navigation/ranger/rangerRepository';
import { useReloadable, type Fetched } from '@navigation/ranger/useReloadable';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

type Loaded =
  | { kind: 'server'; row: IncidentRow; fromCache: boolean }
  | { kind: 'local'; item: OutboxItem<IncidentPayload> }
  | { kind: 'missing' };

export function IncidentDetailScreen({ navigation, route }: RangerScreenProps<'IncidentDetail'>) {
  const { incidentId } = route.params;
  const profile = useProfile();
  const { zoneName, parkName } = useLookups();
  const { version, syncNow, online } = useSync();
  const toast = useToast();
  const [discardOpen, setDiscardOpen] = useState(false);

  const fetcher = useCallback(async (): Promise<Fetched<Loaded | null>> => {
    const local = (await localStore.retrieveIncident<IncidentPayload>()).find((i) => i.payload.incidentId === incidentId);
    if (local) return { data: { kind: 'local', item: local }, fromCache: false };
    const res = await rangerRepository.incident(profile.id, incidentId);
    return {
      data: res.data ? { kind: 'server', row: res.data, fromCache: res.fromCache } : { kind: 'missing' },
      fromCache: res.fromCache,
    };
  }, [incidentId, profile.id]);
  const { data, error, loading, reload: load } = useReloadable(fetcher, null, version);

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Incident" />
        <EmptyState icon={TriangleAlertIcon} tone="critical" title="Could not load the incident" message={error} actionLabel="Retry" onAction={load} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Incident" />
        <LoadingBlock label="Loading incident…" />
      </View>
    );
  }
  if (data.kind === 'missing') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Incident" />
        <EmptyState icon={SearchXIcon} title="Incident not found" message="It may have been removed or is not visible to your account." />
      </View>
    );
  }

  const local = data.kind === 'local' ? data.item : null;
  const row = data.kind === 'server' ? data.row : null;
  const typeName = local ? local.payload.typeName : (row?.type?.type_name ?? 'Incident');
  const code = row ? formatCode('INC', row.incident_no) : 'Pending number';
  const lat = local ? local.payload.latitude : (row?.location?.latitude ?? null);
  const lng = local ? local.payload.longitude : (row?.location?.longitude ?? null);
  const manual = local ? local.payload.manuallyMarked : (row?.location?.manually_marked ?? false);
  const reportedAt = local ? local.payload.reportedAt : (row?.reported_at ?? '');
  const description = local ? local.payload.description : (row?.description ?? '');
  const status = row?.status ?? 'Reported';
  const syncBadge = local ? (local.status === 'failed' ? 'Failed' : 'Pending Sync') : null;
  const statusRank = { Reported: 0, 'Under Review': 1, Resolved: 2 }[status] ?? 0;

  const retry = async () => {
    await localStore.resetFailed(local?.id);
    await syncNow(true);
    toast.show(online ? 'Synchronization started' : 'Will sync when connectivity returns', online ? 'default' : 'warn');
  };

  const discard = async () => {
    if (!local) return;
    await localStore.remove(local.id);
    local.payload.photos.forEach((p) => deleteLocalPhoto(p.localUri));
    setDiscardOpen(false);
    toast.show('Incident discarded from this device', 'warn');
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title={code} subtitle={typeName} />
      <OfflineBanner />
      <Screen padded={false} onRefresh={load} refreshing={loading}>
        {lat !== null && lng !== null ? (
          <MapPanel height={180} rounded={false} markers={[{ id: 'i', latitude: lat, longitude: lng, kind: 'incident' }]} center={{ latitude: lat, longitude: lng }} />
        ) : null}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <StatusBadge status={status} />
            {syncBadge ? <StatusBadge status={syncBadge} size="sm" /> : null}
            <StatusBadge status={manual ? 'Manual' : 'GPS'} size="sm" dot={false} />
          </View>
          <AppText size={18} weight="semibold" style={{ marginTop: 10 }}>
            {typeName}
          </AppText>

          {local?.status === 'failed' ? (
            <Notice
              tone="critical"
              icon={TriangleAlertIcon}
              title="Synchronization failed"
              message={local.lastError ?? 'The server rejected this incident.'}
              style={{ marginTop: 12 }}
            />
          ) : local ? (
            <Notice
              tone="warn"
              icon={CloudOffIcon}
              title="Pending Synchronization"
              message="Stored on this device. It will be sent automatically when connectivity returns."
              style={{ marginTop: 12 }}
            />
          ) : data.kind === 'server' && data.fromCache ? (
            <Notice tone="warn" icon={CloudOffIcon} message="Offline copy - details may be out of date." style={{ marginTop: 12 }} />
          ) : null}

          <Card style={{ padding: 16, marginTop: 12 }}>
            <KeyValue
              items={[
                { label: 'Reported by', value: profile.full_name || '—' },
                { label: 'Date / time', value: formatDateTime(reportedAt) },
                { label: 'Coordinates', value: formatCoord(lat, lng) },
                { label: 'Zone', value: row ? (zoneName(row.zone_id) ?? parkName(row.park_id)) : 'Resolved on sync' },
                { label: 'Recorded offline', value: local || row?.is_offline ? 'Yes' : 'No' },
                { label: 'Synchronized', value: row ? formatDateTime(row.synced_at ?? row.created_at) : 'Not yet' },
              ]}
            />
          </Card>

          <View style={{ marginTop: 18 }}>
            <SectionHeader title="Description" />
            <Card style={{ padding: 14 }}>
              <AppText size={14} lineHeight={21}>
                {description}
              </AppText>
            </Card>
          </View>

          <View style={{ marginTop: 18 }}>
            <SectionHeader title={`Photographs (${local ? local.payload.photos.length : (row?.photos?.length ?? 0)})`} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {local
                ? local.payload.photos.map((p, i) => <PhotoThumb key={p.photoId} uri={p.localUri} index={i} size={96} />)
                : (row?.photos ?? []).map((p, i) => (
                    <PhotoThumb key={p.photo_id} bucket={env.incidentPhotoBucket} path={p.photo_path} index={i} size={96} />
                  ))}
            </View>
          </View>

          <View style={{ marginTop: 18 }}>
            <SectionHeader title="Timeline" />
            <Card style={{ padding: 16 }}>
              <Timeline
                entries={[
                  { label: 'Incident recorded', detail: local || row?.is_offline ? 'Captured offline on this device' : 'Captured in the field', time: formatDateTime(reportedAt), done: true },
                  {
                    label: 'Stored in Central Operations System',
                    detail: local ? (local.status === 'failed' ? 'Synchronization failed' : 'Waiting for connectivity') : 'Supervisor notified',
                    time: row ? formatDateTime(row.synced_at ?? row.created_at) : '—',
                    done: !!row,
                    tone: local?.status === 'failed' ? 'critical' : undefined,
                  },
                  { label: 'Under review', time: '', done: !!row && statusRank >= 1, tone: 'warn' },
                  { label: 'Resolved', time: '', done: !!row && statusRank >= 2, tone: 'ok' },
                ]}
              />
            </Card>
          </View>
        </View>
      </Screen>
      {local ? (
        <StickyFooter>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button variant="outline" style={{ flex: 1 }} onPress={() => setDiscardOpen(true)}>
              Discard
            </Button>
            <Button style={{ flex: 1 }} onPress={() => void retry()}>
              {local.status === 'failed' ? 'Retry sync' : 'Sync now'}
            </Button>
          </View>
        </StickyFooter>
      ) : null}
      <Modal
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        tone="critical"
        icon={TriangleAlertIcon}
        title="Discard this incident?"
        description="The incident and its photographs will be deleted from this device and never reach the Central Operations System."
        actions={
          <>
            <Button full variant="danger" onPress={() => void discard()}>
              Discard incident
            </Button>
            <Button full variant="ghost" onPress={() => setDiscardOpen(false)}>
              Keep it
            </Button>
          </>
        }
      />
    </View>
  );
}
