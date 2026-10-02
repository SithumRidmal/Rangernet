import React from 'react';
import { ClipboardListIcon, RouteIcon, ShieldAlertIcon, SirenIcon } from 'lucide-react-native';
import { MoreScreen } from '@shared/profile/MoreScreen';
import { NotificationsScreen } from '@shared/notifications/NotificationsScreen';
import type { AppNotification } from '@shared/types';
import { useRangerNavigation } from '../navigation/types';

export function RangerMoreScreen() {
  const navigation = useRangerNavigation();
  return (
    <MoreScreen
      tools={[
        { icon: ShieldAlertIcon, label: 'Report incident', subtitle: 'Snare, carcass, campsite, footprints', onPress: () => navigation.navigate('IncidentType') },
        { icon: ClipboardListIcon, label: 'My incidents', subtitle: 'Reported and pending synchronization', onPress: () => navigation.navigate('Tabs', { screen: 'Incidents' }) },
        { icon: RouteIcon, label: 'My patrols', subtitle: 'Assigned routes and patrol history', onPress: () => navigation.navigate('Tabs', { screen: 'Patrols' }) },
        { icon: SirenIcon, label: 'Field responses', subtitle: 'Conflict responses assigned to you', onPress: () => navigation.navigate('Tabs', { screen: 'Responses' }) },
      ]}
    />
  );
}

export function RangerNotificationsScreen() {
  const navigation = useRangerNavigation();
  const open = (n: AppNotification) => {
    if (!n.entity_id) return;
    switch (n.entity_type) {
      case 'patrol':
        navigation.navigate('PatrolDetail', { patrolId: n.entity_id });
        break;
      case 'incident':
        navigation.navigate('IncidentDetail', { incidentId: n.entity_id });
        break;
      case 'response_assignment':
        navigation.navigate('ResponseDetail', { assignmentId: n.entity_id });
        break;
      case 'community_report':
        navigation.navigate('Tabs', { screen: 'Responses' });
        break;
    }
  };
  return <NotificationsScreen onOpen={open} />;
}
