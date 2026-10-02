import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import {
  ActivityIcon,
  CalendarIcon,
  ChartColumnIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  PlusIcon,
  ShieldAlertIcon,
} from 'lucide-react-native';
import {
  ActionTile,
  AppBar,
  AppText,
  BellButton,
  Card,
  MapLegend,
  MapPanel,
  MetricCard,
  OfflineBanner,
  Screen,
  SectionHeader,
  type MapPoint,
} from '@shared/components';
import { useProfile } from '@shared/auth/AuthProvider';
import { useLookups } from '@shared/lookups/useLookups';
import { colors } from '@shared/theme';
import { firstName, formatDate } from '@shared/utils/format';
import type { Patrol } from '../models';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData, type RemoteCodec } from '../hooks/useRemoteData';
import { useAutoReload } from '../hooks/useAutoReload';
import { usePatrolRealtime } from '../hooks/usePatrolRealtime';
import { patrolListCodec } from '../hooks/codecs';
import { fetchIncidents } from '../services/incidentService';
import type { IncidentRow } from '../services/rows';
import { RemoteStatus } from '../components/RemoteStatus';
import { PatrolListRow } from '../components/PatrolItems';
import { IncidentCard, incidentCode, incidentTitle } from '../components/IncidentItems';
import { useSupervisorNavigation } from '../navigation/types';

type DashboardData = { patrols: Patrol[]; incidents: IncidentRow[] };

const dashboardCodec: RemoteCodec<DashboardData> = {
  toCache: (d) => ({ patrols: patrolListCodec.toCache(d.patrols), incidents: d.incidents }),
  fromCache: (c) => {
    const v = c as { patrols: unknown; incidents: IncidentRow[] };
    return { patrols: patrolListCodec.fromCache(v.patrols), incidents: v.incidents };
  },
};

const DAY = 24 * 60 * 60 * 1000;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function DashboardScreen() {
  const navigation = useSupervisorNavigation();
  const profile = useProfile();
  const supervisor = useSupervisor();
  const { parkName, parks } = useLookups();

  const load = useCallback(async (): Promise<DashboardData> => {
    const since = new Date(Date.now() - 7 * DAY).toISOString();
    const [patrols, incidents] = await Promise.all([
      supervisor.getOperationsPatrols(),
      fetchIncidents(supervisor.parkId, since, 200),
    ]);
    return { patrols, incidents };
  }, [supervisor]);

  const remote = useRemoteData(`sup:${supervisor.supervisorId}:dashboard`, load, dashboardCodec);
  useAutoReload(remote.reload);
  usePatrolRealtime(remote.reload, 45000);

  const park = parks.find((p) => p.park_id === supervisor.parkId);
  const center = park ? { latitude: park.center_lat, longitude: park.center_lng } : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        tone="dark"
        hideBack
        title={`${greeting()}, ${firstName(profile.full_name) || 'Supervisor'}`}
        subtitle={`Park Supervisor · ${supervisor.parkId ? parkName(supervisor.parkId) : 'All parks'}`}
        right={<BellButton tone="onDark" />}
      />
      <View style={{ backgroundColor: colors.forest700, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <CalendarIcon size={13} color={colors.forest200} />
        <AppText size={12} color={colors.forest200}>
          {formatDate(new Date())} · Operations dashboard
        </AppText>
      </View>
      <OfflineBanner />
      <Screen onRefresh={remote.refresh} refreshing={remote.refreshing}>
        <RemoteStatus remote={remote} loadingLabel="Loading operations…">
          {(data) => <DashboardContent data={data} center={center} navigation={navigation} />}
        </RemoteStatus>
      </Screen>
    </View>
  );
}

function DashboardContent({
  data,
  center,
  navigation,
}: {
  data: DashboardData;
  center: { latitude: number; longitude: number } | null;
  navigation: ReturnType<typeof useSupervisorNavigation>;
}) {
  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const active = data.patrols.filter((p) => p.status === 'In Progress');
    const completedToday = data.patrols.filter(
      (p) => p.status === 'Completed' && p.endTime && new Date(p.endTime).getTime() >= todayStart.getTime(),
    );
    const review = data.patrols
      .filter((p) => p.needsReview())
      .sort((a, b) => new Date(b.endTime ?? 0).getTime() - new Date(a.endTime ?? 0).getTime());
    const assigned = data.patrols.filter((p) => p.status === 'Assigned');
    return { active, completedToday, review, assigned };
  }, [data.patrols]);

  const markers = useMemo<MapPoint[]>(() => {
    const m: MapPoint[] = [];
    stats.active.forEach((p) => {
      const pos = p.getLastKnownPosition();
      if (pos) {
        m.push({
          id: `r-${p.patrolId}`,
          ...pos.getLocation(),
          kind: 'ranger',
          label: `${p.getRangerName()} · ${p.getCode()}`,
          onPress: () => navigation.navigate('PatrolDetail', { patrolId: p.patrolId }),
        });
      }
    });
    data.incidents.slice(0, 25).forEach((i) => {
      if (i.location?.latitude != null && i.location?.longitude != null) {
        m.push({
          id: `i-${i.incident_id}`,
          latitude: i.location.latitude,
          longitude: i.location.longitude,
          kind: 'incident',
          label: `${incidentCode(i)} · ${incidentTitle(i)}`,
          onPress: () => navigation.navigate('IncidentDetail', { incidentId: i.incident_id }),
        });
      }
    });
    return m;
  }, [stats.active, data.incidents, navigation]);

  const activeWithoutFix = stats.active.filter((p) => !p.getLastKnownPosition()).length;
  const incompleteReview = stats.review.filter((p) => p.status === 'Incomplete').length;

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <MetricCard
          label="Active patrols"
          value={stats.active.length}
          icon={ActivityIcon}
          sub={`${stats.assigned.length} assigned, not started`}
          onPress={() => navigation.navigate('Tabs', { screen: 'Patrols', params: { tab: 'In Progress' } })}
        />
        <MetricCard
          label="Completed today"
          value={stats.completedToday.length}
          icon={CheckCircle2Icon}
          tone="ok"
          sub="Patrols finished since 00:00"
          onPress={() => navigation.navigate('Tabs', { screen: 'Patrols', params: { tab: 'Completed' } })}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <MetricCard
          label="Awaiting review"
          value={stats.review.length}
          icon={ClipboardCheckIcon}
          tone={incompleteReview ? 'warn' : 'info'}
          sub={`${incompleteReview} incomplete`}
          onPress={() => navigation.navigate('Tabs', { screen: 'Patrols', params: { tab: incompleteReview ? 'Incomplete' : 'Completed' } })}
        />
        <MetricCard
          label="Incidents (7 days)"
          value={data.incidents.length >= 200 ? '200+' : data.incidents.length}
          icon={ShieldAlertIcon}
          tone="critical"
          sub="Reported by rangers"
          onPress={() => navigation.navigate('Incidents')}
        />
      </View>

      <Card style={{ marginTop: 16, overflow: 'hidden' }}>
        <MapPanel markers={markers} height={190} rounded={false} center={center}>
          <View pointerEvents="none" style={{ position: 'absolute', left: 8, bottom: 8 }}>
            <MapLegend
              items={[
                { color: colors.forest500, label: 'Rangers on patrol' },
                { color: colors.crit, label: 'Incidents (7 days)' },
              ]}
            />
          </View>
        </MapPanel>
        <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
          <AppText size={13} weight="medium">
            Live operations map
          </AppText>
          <AppText size={12} color={colors.muted} style={{ marginTop: 2 }}>
            {markers.length
              ? 'Tap a marker for details. Ranger dots show the last recorded position.'
              : 'No active patrol positions or recent incidents to show.'}
            {activeWithoutFix ? ` ${activeWithoutFix} active patrol${activeWithoutFix === 1 ? ' has' : 's have'} no position yet.` : ''}
          </AppText>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <ActionTile icon={PlusIcon} label="Assign patrol" sub="Plan a route" tone="solid" onPress={() => navigation.navigate('PatrolForm')} />
        <ActionTile
          icon={ChartColumnIcon}
          label="Coverage"
          sub="Zones and gaps"
          onPress={() => navigation.navigate('Tabs', { screen: 'Coverage' })}
        />
      </View>

      <View style={{ marginTop: 20 }}>
        <SectionHeader
          title={`Needs review (${stats.review.length})`}
          action={stats.review.length ? 'All' : undefined}
          onAction={() => navigation.navigate('Tabs', { screen: 'Patrols', params: { tab: incompleteReview ? 'Incomplete' : 'Completed' } })}
        />
        <Card>
          {stats.review.length ? (
            stats.review.slice(0, 5).map((p, i) => (
              <PatrolListRow key={p.patrolId} patrol={p} first={i === 0} onPress={() => navigation.navigate('PatrolDetail', { patrolId: p.patrolId })} />
            ))
          ) : (
            <AppText size={13} color={colors.muted} style={{ padding: 16 }}>
              Every completed and incomplete patrol has been reviewed.
            </AppText>
          )}
        </Card>
      </View>

      <View style={{ marginTop: 20 }}>
        <SectionHeader
          title={`Patrols in progress (${stats.active.length})`}
          action={stats.active.length ? 'All' : undefined}
          onAction={() => navigation.navigate('Tabs', { screen: 'Patrols', params: { tab: 'In Progress' } })}
        />
        <Card>
          {stats.active.length ? (
            stats.active.slice(0, 5).map((p, i) => (
              <PatrolListRow key={p.patrolId} patrol={p} first={i === 0} onPress={() => navigation.navigate('PatrolDetail', { patrolId: p.patrolId })} />
            ))
          ) : (
            <AppText size={13} color={colors.muted} style={{ padding: 16 }}>
              No ranger is on patrol right now.
            </AppText>
          )}
        </Card>
      </View>

      <View style={{ marginTop: 20, marginBottom: 8 }}>
        <SectionHeader title="Recent incidents" action="All incidents" onAction={() => navigation.navigate('Incidents')} />
        {data.incidents.length ? (
          <View style={{ gap: 12 }}>
            {data.incidents.slice(0, 4).map((i) => (
              <IncidentCard key={i.incident_id} incident={i} onPress={() => navigation.navigate('IncidentDetail', { incidentId: i.incident_id })} />
            ))}
          </View>
        ) : (
          <Card style={{ padding: 16 }}>
            <AppText size={13} color={colors.muted}>
              No incidents reported in the last 7 days.
            </AppText>
          </Card>
        )}
      </View>
    </>
  );
}
