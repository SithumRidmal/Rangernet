import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { FootprintsIcon, PlusIcon } from 'lucide-react-native';
import { AppBar, AppText, BellButton, Button, EmptyState, OfflineBanner, Screen, StickyFooter, Tabs } from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { PATROL_STATUSES, type PatrolStatus } from '../services/rows';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData } from '../hooks/useRemoteData';
import { useAutoReload } from '../hooks/useAutoReload';
import { usePatrolRealtime } from '../hooks/usePatrolRealtime';
import { patrolListCodec } from '../hooks/codecs';
import { RemoteStatus } from '../components/RemoteStatus';
import { SupervisorPatrolCard } from '../components/PatrolItems';
import { useSupervisorNavigation, type SupervisorTabParamList } from '../navigation/types';

const EMPTY: Record<PatrolStatus, { title: string; message: string }> = {
  Assigned: { title: 'No patrols waiting to start', message: 'Assign a patrol route and it will appear on the ranger’s My Patrols list.' },
  'In Progress': { title: 'No patrol in progress', message: 'When a ranger taps Start Patrol it shows here with live tracking.' },
  Completed: { title: 'No completed patrols', message: 'Completed patrols with route, waypoints and coverage appear here.' },
  Incomplete: { title: 'No incomplete patrols', message: 'Patrols a ranger stopped early are listed here for your review.' },
};

export function PatrolsScreen({ route }: BottomTabScreenProps<SupervisorTabParamList, 'Patrols'>) {
  const navigation = useSupervisorNavigation();
  const supervisor = useSupervisor();
  const { parkName } = useLookups();
  const { online } = useSync();
  const [tab, setTab] = useState<PatrolStatus>(route.params?.tab ?? 'Assigned');
  const [paramTab, setParamTab] = useState(route.params?.tab);
  if (route.params?.tab !== paramTab) {
    setParamTab(route.params?.tab);
    if (route.params?.tab) setTab(route.params.tab);
  }

  const load = useCallback(() => supervisor.getPatrols({ limit: 300 }), [supervisor]);
  const remote = useRemoteData(`sup:${supervisor.supervisorId}:patrols`, load, patrolListCodec);
  useAutoReload(remote.reload);
  usePatrolRealtime(remote.reload);

  const counts = useMemo(() => {
    const c: Record<PatrolStatus, number> = { Assigned: 0, 'In Progress': 0, Completed: 0, Incomplete: 0 };
    remote.data?.forEach((p) => (c[p.status] += 1));
    return c;
  }, [remote.data]);


  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title="Patrols"
        subtitle={supervisor.parkId ? parkName(supervisor.parkId) : 'All parks'}
        hideBack
        right={<BellButton />}
      />
      <OfflineBanner />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Tabs tabs={PATROL_STATUSES} value={tab} onChange={setTab} />
        {remote.data ? (
          <AppText size={12} color={colors.muted} style={{ marginTop: 8 }}>
            {counts.Assigned} assigned · {counts['In Progress']} in progress · {counts.Completed} completed · {counts.Incomplete} incomplete
          </AppText>
        ) : null}
      </View>
      <Screen onRefresh={remote.refresh} refreshing={remote.refreshing}>
        <RemoteStatus remote={remote} loadingLabel="Loading patrols…">
          {(patrols) => {
            const list = patrols
              .filter((p) => p.status === tab)
              .sort((a, b) => {
                if (tab === 'Completed' || tab === 'Incomplete') {
                  const review = Number(b.needsReview()) - Number(a.needsReview());
                  if (review) return review;
                }
                const ta = new Date(a.getDisplayTime() ?? 0).getTime();
                const tb = new Date(b.getDisplayTime() ?? 0).getTime();
                return tab === 'Assigned' ? ta - tb : tb - ta;
              });
            if (!list.length) {
              return (
                <EmptyState
                  icon={FootprintsIcon}
                  title={EMPTY[tab].title}
                  message={EMPTY[tab].message}
                  actionLabel={tab === 'Assigned' && online ? 'Assign patrol' : undefined}
                  onAction={() => navigation.navigate('PatrolForm')}
                />
              );
            }
            return (
              <View style={{ gap: 12 }}>
                {list.map((p) => (
                  <SupervisorPatrolCard key={p.patrolId} patrol={p} onPress={() => navigation.navigate('PatrolDetail', { patrolId: p.patrolId })} />
                ))}
              </View>
            );
          }}
        </RemoteStatus>
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={PlusIcon} disabled={!online} onPress={() => navigation.navigate('PatrolForm')}>
          {online ? 'Assign patrol' : 'Assign patrol (needs connection)'}
        </Button>
      </StickyFooter>
    </View>
  );
}
