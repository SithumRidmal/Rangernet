import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SearchIcon, UsersIcon } from 'lucide-react-native';
import { AppBar, BellButton, EmptyState, FilterChips, Input, OfflineBanner, PersonCard, Screen } from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { colors } from '@shared/theme';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData } from '../hooks/useRemoteData';
import { useAutoReload } from '../hooks/useAutoReload';
import { usePatrolRealtime } from '../hooks/usePatrolRealtime';
import { fetchRangerOverview } from '../services/rangerService';
import { RemoteStatus } from '../components/RemoteStatus';
import { useSupervisorNavigation } from '../navigation/types';

const FILTERS = ['All', 'On Patrol', 'Available'] as const;
type RangerFilter = (typeof FILTERS)[number];

export function RangersScreen() {
  const navigation = useSupervisorNavigation();
  const supervisor = useSupervisor();
  const { parkName } = useLookups();
  const [filter, setFilter] = useState<RangerFilter>('All');
  const [query, setQuery] = useState('');

  const load = useCallback(() => fetchRangerOverview(supervisor.parkId), [supervisor.parkId]);
  const remote = useRemoteData(`sup:${supervisor.supervisorId}:rangers`, load);
  useAutoReload(remote.reload);
  usePatrolRealtime(remote.reload);

  const onPatrol = remote.data?.filter((r) => r.onPatrol).length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title="Rangers"
        subtitle={remote.data ? `${remote.data.length} on roster · ${onPatrol} on patrol` : undefined}
        hideBack
        right={<BellButton />}
      />
      <OfflineBanner />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Input icon={SearchIcon} placeholder="Search name or employee ID" value={query} onChangeText={setQuery} autoCapitalize="none" />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </View>
      <Screen onRefresh={remote.refresh} refreshing={remote.refreshing}>
        <RemoteStatus remote={remote} loadingLabel="Loading rangers…">
          {(rangers) => {
            const q = query.trim().toLowerCase();
            const list = rangers.filter(
              (r) =>
                (filter === 'All' || (filter === 'On Patrol') === r.onPatrol) &&
                (!q || r.full_name.toLowerCase().includes(q) || (r.employee_id ?? '').toLowerCase().includes(q)),
            );
            if (!list.length) {
              return (
                <EmptyState
                  icon={UsersIcon}
                  title={rangers.length ? 'No matching rangers' : 'No rangers yet'}
                  message={
                    rangers.length
                      ? 'Change the search or filter.'
                      : 'Rangers appear here after they register with the Ranger role for this park.'
                  }
                />
              );
            }
            return (
              <View style={{ gap: 10 }}>
                {list.map((r) => (
                  <PersonCard
                    key={r.id}
                    name={r.full_name || 'Unnamed ranger'}
                    subtitle={`${r.employee_id ?? 'No employee ID'} · ${r.park_id ? parkName(r.park_id) : 'No park set'}`}
                    detail={`${r.assignedCount} assigned · ${r.completedCount} completed${r.incompleteCount ? ` · ${r.incompleteCount} incomplete` : ''}`}
                    status={r.onPatrol ? 'On Patrol' : 'Available'}
                    onPress={() => navigation.navigate('RangerDetail', { rangerId: r.id })}
                  />
                ))}
              </View>
            );
          }}
        </RemoteStatus>
      </Screen>
    </View>
  );
}
