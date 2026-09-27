import React from 'react';
import { SirenIcon } from 'lucide-react-native';
import { SuccessScreen } from '@shared/components';
import { formatDateTime } from '@shared/utils/format';
import type { CloStackScreenProps } from '../navigation/types';

export function ResponseCoordinatedScreen({ route, navigation }: CloStackScreenProps<'ResponseCoordinated'>) {
  const { assignmentId, reportCode, rangerName, assignedAt, reassigned } = route.params;
  return (
    <SuccessScreen
      icon={SirenIcon}
      title={reassigned ? 'Ranger reassigned' : 'Response coordinated'}
      message={`${rangerName} has been notified of the high-risk conflict. The report is now tracked as Responding.`}
      meta={[
        { label: 'Report', value: reportCode },
        { label: 'Ranger', value: rangerName },
        { label: 'Response status', value: 'Assigned' },
        { label: 'Notified', value: formatDateTime(assignedAt) },
      ]}
      primaryLabel="Track response"
      onPrimary={() => navigation.replace('ResponseTracking', { assignmentId })}
      secondaryLabel="Back to dashboard"
      onSecondary={() => {
        navigation.popToTop();
        navigation.navigate('Tabs', { screen: 'Dashboard' });
      }}
    />
  );
}
