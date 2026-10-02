import React from 'react';
import { ClipboardListIcon, CloudIcon, MessageSquareTextIcon } from 'lucide-react-native';
import { MoreScreen, type MoreTool } from '@shared/profile/MoreScreen';
import { env } from '@shared/config/env';
import { useSync } from '@shared/sync/SyncProvider';
import { isSmsReportingConfigured } from '../services/SmsReportService';
import { useCommunityNavigation } from '../navigation/types';

export function MoreTabScreen() {
  const navigation = useCommunityNavigation();
  const { pending, failed } = useSync();
  const unsynced = pending + failed;

  const tools: MoreTool[] = [
    ...(isSmsReportingConfigured()
      ? [
          {
            icon: MessageSquareTextIcon,
            label: 'Report by SMS',
            subtitle: `Text ${env.smsReportNumber} – no internet data needed`,
            onPress: () => navigation.navigate('SmsReport'),
          },
        ]
      : []),
    {
      icon: ClipboardListIcon,
      label: 'My reports',
      subtitle: 'Status of the conflicts you reported',
      onPress: () => navigation.navigate('Tabs', { screen: 'MyReports' }),
    },
    {
      icon: CloudIcon,
      label: 'Sync Center',
      subtitle: unsynced ? `${unsynced} report${unsynced === 1 ? '' : 's'} stored on this device` : 'All reports sent',
      onPress: () => navigation.navigate('SyncCenter'),
    },
  ];

  return <MoreScreen tools={tools} />;
}
