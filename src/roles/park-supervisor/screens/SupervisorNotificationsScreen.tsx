import React from 'react';
import { NotificationsScreen } from '@shared/notifications/NotificationsScreen';
import type { AppNotification } from '@shared/types';
import { useSupervisorNavigation } from '../navigation/types';

export function SupervisorNotificationsScreen() {
  const navigation = useSupervisorNavigation();
  const open = (n: AppNotification) => {
    if (!n.entity_id) return;
    if (n.entity_type === 'patrol') navigation.navigate('PatrolDetail', { patrolId: n.entity_id });
    else if (n.entity_type === 'incident') navigation.navigate('IncidentDetail', { incidentId: n.entity_id });
  };
  return <NotificationsScreen onOpen={open} />;
}
