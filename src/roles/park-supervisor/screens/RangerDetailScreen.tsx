import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { FootprintsIcon, PlusIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Avatar,
  BellButton,
  Button,
  Card,
  EmptyState,
  KeyValue,
  MapPanel,
  OfflineBanner,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
} from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { formatCoord, relativeTime } from '@shared/utils/format';
import { Patrol } from '../models';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData, type RemoteCodec } from '../hooks/useRemoteData';
import { useAutoReload } from '../hooks/useAutoReload';
import { fetchRanger } from '../services/rangerService';
import { attachLastPositions, fetchPatrols } from '../services/patrolService';
import type { PatrolRow, RangerRow } from '../services/rows';
import { RemoteStatus } from '../components/RemoteStatus';
import { SupervisorPatrolCard } from '../components/PatrolItems';
import type { SupervisorScreenProps } from '../navigation/types';

type RangerData = { ranger: RangerRow; patrols: Patrol[] };

const codec: RemoteCodec<RangerData> = {
  toCache: (d) => ({ ranger: d.ranger, patrols: d.patrols.map((p) => p.toRow()) }),
  fromCache: (c) => {
    const v = c as { ranger: RangerRow; patrols: PatrolRow[] };
    return { ranger: v.ranger, patrols: v.patrols.map((r) => Patrol.fromRow(r)) };
  },
};

export function RangerDetailScreen({ navigation, route }: SupervisorScreenProps<'RangerDetail'>) {
  const { rangerId } = route.params;
  const supervisor = useSupervisor();
  const { online } = useSync();

  const load = useCallback(async (): Promise<RangerData> => {
    const scope = { supervisorId: supervisor.supervisorId, parkId: supervisor.parkId };
    const [ranger, rows] = await Promise.all([fetchRanger(rangerId), fetchPatrols(scope, { rangerId, limit: 100 })]);
    return { ranger, patrols: (await attachLastPositions(rows)).map((r) => Patrol.fromRow(r)) };
  }, [rangerId, supervisor]);

  const remote = useRemoteData(`sup:${supervisor.supervisorId}:ranger:${rangerId}`, load, codec);
  useAutoReload(remote.reload);

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title={remote.data?.ranger.full_name || 'Ranger'}
        subtitle={remote.data ? `${remote.data.ranger.employee_id ?? 'Ranger'} · Field Ranger` : undefined}
        right={<BellButton />}
      />
      <OfflineBanner />
      <Screen onRefresh={remote.refresh} refreshing={remote.refreshing}>
        <RemoteStatus remote={remote} loadingLabel="Loading ranger…">
          {(d) => <RangerBody data={d} onOpen={(id) => navigation.navigate('PatrolDetail', { patrolId: id })} />}
        </RemoteStatus>
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={PlusIcon} disabled={!online} onPress={() => navigation.navigate('PatrolForm', { rangerId })}>
          Assign patrol to this ranger
        </Button>
      </StickyFooter>
    </View>
  );
}

function RangerBody({ data, onOpen }: { data: RangerData; onOpen: (patrolId: string) => void }) {
  const { parkName } = useLookups();
  const { ranger, patrols } = data;
  const active = patrols.find((p) => p.status === 'In Progress');
  const position = active?.getLastKnownPosition() ?? null;
  const counts = useMemo(() => {
    const c = { Assigned: 0, 'In Progress': 0, Completed: 0, Incomplete: 0 };
    patrols.forEach((p) => (c[p.status] += 1));
    return c;
  }, [patrols]);

  return (
    <>
      <Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={ranger.full_name} size={56} />
          <View style={{ flex: 1 }}>
            <AppText size={16} weight="semibold">
              {ranger.full_name || 'Unnamed ranger'}
            </AppText>
            <AppText size={12} color={colors.muted}>
              {ranger.employee_id ?? 'No employee ID'} · {ranger.park_id ? parkName(ranger.park_id) : 'No park set'}
            </AppText>
            <View style={{ marginTop: 6 }}>
              <StatusBadge status={active ? 'On Patrol' : 'Available'} size="sm" />
            </View>
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
          <KeyValue
            items={[
              { label: 'Contact', value: ranger.contact_number ?? '—' },
              { label: 'E-mail', value: ranger.email ?? '—' },
              { label: 'Assigned', value: String(counts.Assigned) },
              { label: 'Completed', value: String(counts.Completed) },
              { label: 'Incomplete', value: String(counts.Incomplete) },
              { label: 'In progress', value: String(counts['In Progress']) },
            ]}
          />
        </View>
      </Card>

      {active ? (
        <View style={{ marginTop: 20 }}>
          <SectionHeader title="Active patrol" action="Open" onAction={() => onOpen(active.patrolId)} />
          {position ? (
            <Card style={{ overflow: 'hidden', marginBottom: 12 }}>
              <MapPanel
                markers={[{ id: 'pos', ...position.getLocation(), kind: 'ranger', label: 'Last known position' }]}
                height={150}
                rounded={false}
              />
              <AppText size={12} color={colors.muted} style={{ padding: 12 }}>
                {formatCoord(position.latitude, position.longitude)} · updated {relativeTime(position.timestamp)}
              </AppText>
            </Card>
          ) : null}
          <SupervisorPatrolCard patrol={active} onPress={() => onOpen(active.patrolId)} />
        </View>
      ) : null}

      <View style={{ marginTop: 20, marginBottom: 8 }}>
        <SectionHeader title={`Patrols (${patrols.length})`} />
        {patrols.filter((p) => p !== active).length ? (
          <View style={{ gap: 12 }}>
            {patrols
              .filter((p) => p !== active)
              .map((p) => (
                <SupervisorPatrolCard key={p.patrolId} patrol={p} onPress={() => onOpen(p.patrolId)} />
              ))}
          </View>
        ) : !active ? (
          <EmptyState icon={FootprintsIcon} title="No patrols yet" message="Patrols you assign to this ranger will appear here." />
        ) : null}
      </View>
    </>
  );
}
