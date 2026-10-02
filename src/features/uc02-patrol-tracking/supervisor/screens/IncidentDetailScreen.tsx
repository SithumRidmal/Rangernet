import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { XIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BellButton,
  Button,
  Card,
  KeyValue,
  MapPanel,
  Modal,
  OfflineBanner,
  PhotoThumb,
  Screen,
  SectionHeader,
  StatusBadge,
} from '@shared/components';
import { env } from '@shared/config/env';
import { useLookups } from '@shared/lookups/useLookups';
import { colors } from '@shared/theme';
import { formatCoord, formatDateTime } from '@shared/utils/format';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData } from '../hooks/useRemoteData';
import { useAutoReload } from '../hooks/useAutoReload';
import { fetchIncident } from '../services/incidentService';
import type { IncidentRow } from '../services/rows';
import { RemoteStatus } from '../components/RemoteStatus';
import { incidentCode, incidentTitle } from '../components/IncidentItems';
import type { SupervisorScreenProps } from '../navigation/types';

export function IncidentDetailScreen({ route }: SupervisorScreenProps<'IncidentDetail'>) {
  const { incidentId } = route.params;
  const supervisor = useSupervisor();
  const { zoneName, parkName } = useLookups();

  const load = useCallback(() => fetchIncident(incidentId), [incidentId]);
  const remote = useRemoteData(`sup:${supervisor.supervisorId}:incident:${incidentId}`, load);
  useAutoReload(remote.reload);

  const i = remote.data;
  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title={i ? incidentCode(i) : 'Incident'}
        subtitle={i ? (zoneName(i.zone_id) ?? parkName(i.park_id)) : undefined}
        right={<BellButton />}
      />
      <OfflineBanner />
      <Screen onRefresh={remote.refresh} refreshing={remote.refreshing}>
        <RemoteStatus remote={remote} loadingLabel="Loading incident…">
          {(incident) => <IncidentBody incident={incident} />}
        </RemoteStatus>
      </Screen>
    </View>
  );
}

function IncidentBody({ incident }: { incident: IncidentRow }) {
  const { zoneName, parkName } = useLookups();
  const [preview, setPreview] = useState<string | null>(null);
  const loc = incident.location;
  const hasCoords = loc?.latitude != null && loc?.longitude != null;
  const photos = incident.photos ?? [];

  return (
    <>
      {hasCoords ? (
        <Card style={{ overflow: 'hidden' }}>
          <MapPanel
            markers={[{ id: 'inc', latitude: loc.latitude as number, longitude: loc.longitude as number, kind: 'incident', label: incidentTitle(incident) }]}
            height={190}
            rounded={false}
          />
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: hasCoords ? 14 : 0 }}>
        <StatusBadge status={incident.status} />
        <StatusBadge status={loc?.manually_marked ? 'Manual' : 'GPS'} dot={false} />
        {incident.is_offline ? <StatusBadge status="Recorded offline" dot={false} /> : null}
      </View>
      <AppText size={17} weight="semibold" style={{ marginTop: 8 }}>
        {incidentTitle(incident)}
      </AppText>

      <Card style={{ marginTop: 12, padding: 16 }}>
        <KeyValue
          items={[
            { label: 'Reported by', value: incident.ranger?.full_name ?? '—' },
            { label: 'Employee ID', value: incident.ranger?.employee_id ?? '—' },
            { label: 'Recorded', value: formatDateTime(incident.reported_at) },
            { label: 'Received', value: formatDateTime(incident.synced_at) },
            { label: 'Zone', value: zoneName(incident.zone_id) ?? '—' },
            { label: 'Park', value: parkName(incident.park_id) },
            { label: 'Location', value: hasCoords ? formatCoord(loc?.latitude, loc?.longitude) : (loc?.location_description ?? '—') },
            { label: 'Location source', value: loc?.manually_marked ? 'Marked manually' : 'GPS' },
          ]}
        />
      </Card>

      <View style={{ marginTop: 20 }}>
        <SectionHeader title="Description" />
        <Card style={{ padding: 16 }}>
          <AppText size={14} lineHeight={21}>
            {incident.description}
          </AppText>
        </Card>
      </View>

      <View style={{ marginTop: 20, marginBottom: 8 }}>
        <SectionHeader title={`Photographs (${photos.length})`} />
        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {photos.map((ph, idx) => (
              <PhotoThumb
                key={ph.photo_id}
                bucket={env.incidentPhotoBucket}
                path={ph.photo_path}
                index={idx}
                size={96}
                onPress={() => setPreview(ph.photo_path)}
              />
            ))}
          </ScrollView>
        ) : (
          <AppText size={13} color={colors.muted}>
            No photographs attached.
          </AppText>
        )}
      </View>

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="Incident photo"
        actions={
          <Button full variant="ghost" icon={XIcon} onPress={() => setPreview(null)}>
            Close
          </Button>
        }
      >
        {preview ? (
          <View style={{ alignItems: 'center' }}>
            <PhotoThumb bucket={env.incidentPhotoBucket} path={preview} size={280} />
          </View>
        ) : null}
      </Modal>
    </>
  );
}
