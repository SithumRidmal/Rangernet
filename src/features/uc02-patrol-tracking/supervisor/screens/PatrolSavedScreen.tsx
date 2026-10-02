import React from 'react';
import { SuccessScreen } from '@shared/components';
import { formatDateTime, formatKm } from '@shared/utils/format';
import type { SupervisorScreenProps } from '../navigation/types';

export function PatrolSavedScreen({ navigation, route }: SupervisorScreenProps<'PatrolSaved'>) {
  const p = route.params;
  const updated = p.mode === 'updated';
  return (
    <SuccessScreen
      title={updated ? 'Route updated' : 'Patrol assigned'}
      message={
        updated
          ? `${p.rangerName} has been notified. The patrol now shows “Route updated” with the new route on their device.`
          : `${p.rangerName} has been notified. The route, waypoints and instructions appear on their My Patrols list.`
      }
      meta={[
        { label: 'Route', value: p.title },
        { label: 'Ranger', value: p.rangerName },
        { label: 'Scheduled', value: formatDateTime(p.scheduledFor) },
        { label: 'Waypoints', value: String(p.waypointCount) },
        { label: 'Planned distance', value: formatKm(p.plannedDistanceKm) },
        { label: 'Status', value: 'Assigned' },
      ]}
      primaryLabel="View patrol"
      onPrimary={() => navigation.popTo('PatrolDetail', { patrolId: p.patrolId })}
      secondaryLabel={updated ? 'Back to patrols' : 'Assign another patrol'}
      onSecondary={() =>
        updated
          ? navigation.navigate('Tabs', { screen: 'Patrols', params: { tab: 'Assigned' } })
          : navigation.replace('PatrolForm')
      }
    />
  );
}
