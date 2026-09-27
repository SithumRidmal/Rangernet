import React from 'react';
import { NotificationsScreen } from '@shared/notifications/NotificationsScreen';
import type { CloStackScreenProps } from '../navigation/types';

export function CloNotificationsScreen({ navigation }: CloStackScreenProps<'Notifications'>) {
  return (
    <NotificationsScreen
      onOpen={(n) => {
        if (!n.entity_id) return;
        if (n.entity_type === 'community_report') navigation.push('ReportReview', { reportId: n.entity_id });
        else if (n.entity_type === 'response_assignment') navigation.push('ResponseTracking', { assignmentId: n.entity_id });
      }}
    />
  );
}
