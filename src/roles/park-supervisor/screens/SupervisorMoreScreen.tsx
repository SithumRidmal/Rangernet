import React from 'react';
import { ChartColumnIcon, ClipboardCheckIcon, PlusIcon, ShieldAlertIcon } from 'lucide-react-native';
import { MoreScreen } from '@shared/profile/MoreScreen';
import { useSupervisorNavigation } from '../navigation/types';

export function SupervisorMoreScreen() {
  const navigation = useSupervisorNavigation();
  return (
    <MoreScreen
      tools={[
        {
          icon: PlusIcon,
          label: 'Assign patrol',
          subtitle: 'Plan a route for a ranger',
          onPress: () => navigation.navigate('PatrolForm'),
        },
        {
          icon: ClipboardCheckIcon,
          label: 'Review incomplete patrols',
          subtitle: 'Patrols stopped early by rangers',
          onPress: () => navigation.navigate('Tabs', { screen: 'Patrols', params: { tab: 'Incomplete' } }),
        },
        {
          icon: ChartColumnIcon,
          label: 'Patrol coverage',
          subtitle: 'Coverage by zone and gaps',
          onPress: () => navigation.navigate('Tabs', { screen: 'Coverage' }),
        },
        {
          icon: ShieldAlertIcon,
          label: 'Incidents',
          subtitle: 'Read-only incident feed',
          onPress: () => navigation.navigate('Incidents'),
        },
      ]}
    />
  );
}
