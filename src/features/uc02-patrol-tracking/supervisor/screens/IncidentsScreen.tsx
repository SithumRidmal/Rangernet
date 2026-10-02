import React, { useCallback } from 'react';
import { View } from 'react-native';
import { ShieldAlertIcon } from 'lucide-react-native';
import { AppBar, AppText, BellButton, EmptyState, OfflineBanner, Screen } from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { colors } from '@shared/theme';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData } from '../hooks/useRemoteData';
import { useAutoReload } from '../hooks/useAutoReload';
import { fetchIncidents } from '../services/incidentService';
import { RemoteStatus } from '../components/RemoteStatus';
import { IncidentCard } from '../components/IncidentItems';
import type { SupervisorScreenProps } from '../navigation/types';

const DAYS = 30;

export function IncidentsScreen({ navigation }: SupervisorScreenProps<'Incidents'>) {
  const supervisor = useSupervisor();
  const { parkName } = useLookups();

  const load = useCallback(
    () => fetchIncidents(supervisor.parkId, new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString(), 200),
    [supervisor.parkId],
  );
  const remote = useRemoteData(`sup:${supervisor.supervisorId}:incidents`, load);
  useAutoReload(remote.reload);

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title="Incidents"
        subtitle={`Last ${DAYS} days · ${supervisor.parkId ? parkName(supervisor.parkId) : 'All parks'}`}
        right={<BellButton />}
      />
      <OfflineBanner />
      <Screen onRefresh={remote.refresh} refreshing={remote.refreshing}>
        <RemoteStatus remote={remote} loadingLabel="Loading incidents…">
          {(list) =>
            list.length ? (
              <View style={{ gap: 12 }}>
                <AppText size={12} color={colors.muted}>
                  Read-only view of incidents reported by rangers.
                </AppText>
                {list.map((i) => (
                  <IncidentCard key={i.incident_id} incident={i} onPress={() => navigation.navigate('IncidentDetail', { incidentId: i.incident_id })} />
                ))}
              </View>
            ) : (
              <EmptyState icon={ShieldAlertIcon} title="No incidents" message={`No incidents were reported in the last ${DAYS} days.`} />
            )
          }
        </RemoteStatus>
      </Screen>
    </View>
  );
}
