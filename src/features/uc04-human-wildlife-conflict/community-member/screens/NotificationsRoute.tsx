import React from 'react';
import { NotificationsScreen } from '@shared/notifications/NotificationsScreen';
import { useCommunityNavigation } from '../navigation/types';

export function NotificationsRoute() {
  const navigation = useCommunityNavigation();
  return (
    <NotificationsScreen
      onOpen={(n) => {
        if (n.entity_type === 'community_report' && n.entity_id) {
          navigation.navigate('ReportDetail', { reportId: n.entity_id });
        }
      }}
    />
  );
}
