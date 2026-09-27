import React from 'react';
import { ChartNoAxesCombinedIcon, FileTextIcon } from 'lucide-react-native';
import { MoreScreen } from '@shared/profile/MoreScreen';
import { useParkManagerNavigation } from '../navigation/types';

export function MoreTabScreen() {
  const navigation = useParkManagerNavigation();
  return (
    <MoreScreen
      tools={[
        {
          icon: ChartNoAxesCombinedIcon,
          label: 'New analysis',
          subtitle: 'Incident trends, patrol coverage, conflicts',
          onPress: () => navigation.navigate('Tabs', { screen: 'Analysis' }),
        },
        {
          icon: FileTextIcon,
          label: 'Reports library',
          subtitle: 'Generated PDF conservation reports',
          onPress: () => navigation.navigate('Tabs', { screen: 'Reports' }),
        },
      ]}
    />
  );
}
