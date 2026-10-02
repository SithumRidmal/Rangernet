import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { CopyIcon, ShieldAlertIcon, SirenIcon } from 'lucide-react-native';
import { MoreScreen } from '@shared/profile/MoreScreen';
import type { CloNavigation } from '../navigation/types';

export function CloMoreScreen() {
  const navigation = useNavigation<CloNavigation>();
  return (
    <MoreScreen
      tools={[
        {
          icon: CopyIcon,
          label: 'Duplicates review',
          subtitle: 'Reports flagged as similar to a recent report',
          onPress: () => navigation.navigate('Tabs', { screen: 'Reports', params: { filter: 'Duplicates', at: Date.now() } }),
        },
        {
          icon: SirenIcon,
          label: 'Responses',
          subtitle: 'Track coordinated ranger responses',
          onPress: () => navigation.navigate('Tabs', { screen: 'Responses' }),
        },
        {
          icon: ShieldAlertIcon,
          label: 'High-risk conflicts',
          subtitle: 'Reports with an active field response',
          onPress: () => navigation.navigate('Tabs', { screen: 'Reports', params: { filter: 'Responding', at: Date.now() } }),
        },
      ]}
    />
  );
}
