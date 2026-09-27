import React from 'react';
import { NotificationsScreen } from '@shared/notifications/NotificationsScreen';
import type { AppNotification } from '@shared/types';
import { useParkManagerNavigation } from '../navigation/types';

export function NotificationsRoute() {
  const navigation = useParkManagerNavigation();
  const open = (n: AppNotification) => {
    if (!n.entity_id) return;
    const entity = n.entity_type?.toLowerCase();
    if (entity === 'report' || entity === 'reports') navigation.navigate('ReportDetail', { reportId: n.entity_id });
    else if (entity === 'analytics' || entity === 'analysis') navigation.navigate('AnalysisResults', { analysisId: n.entity_id });
  };
  return <NotificationsScreen onOpen={open} />;
}
