import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2Icon, CloudOffIcon, CopyIcon } from 'lucide-react-native';
import { SuccessScreen } from '@shared/components';
import { formatDateTime } from '@shared/utils/format';
import { reportCode } from '../../components/ReportListCard';
import type { CommunityStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ReportSuccess'>;

/** UC-04 main flow step 6 (confirmation), offline storage and duplicate-report outcomes. */
export function ReportSuccessScreen({ navigation, route }: Props) {
  const p = route.params;
  const stored = p.mode === 'stored';
  const code = stored ? 'Assigned after sync' : reportCode(p.reportNo);

  const meta = [
    { label: 'Report', value: code },
    { label: 'Type', value: p.typeName },
    { label: 'Time', value: formatDateTime(p.reportedAt) },
    { label: 'Channel', value: 'App' },
    { label: 'Status', value: stored ? 'Pending Synchronization' : p.flaggedDuplicate ? 'Flagged for review' : 'Reported' },
    { label: 'Photos', value: p.photoCount ? String(p.photoCount) : 'None' },
  ];

  const title = stored ? 'Saved on this device' : p.flaggedDuplicate ? 'Report submitted – flagged for review' : 'Report submitted';
  const message = stored
    ? `${
        p.storedReason === 'network' ? 'The server could not be reached. ' : ''
      }Your report is Pending Synchronization – it will be sent automatically when you are back online.`
    : p.flaggedDuplicate
      ? `A similar ${p.typeName.toLowerCase()} report was made near this place recently. Your report was flagged so a Community Liaison Officer can review both and avoid sending a duplicate response.`
      : 'Your report is now on the operations dashboard. A Community Liaison Officer will review it and you will be notified about updates.';

  return (
    <SuccessScreen
      tone={stored || p.flaggedDuplicate ? 'warn' : 'ok'}
      icon={stored ? CloudOffIcon : p.flaggedDuplicate ? CopyIcon : CheckCircle2Icon}
      title={title}
      message={message}
      meta={meta}
      primaryLabel="View report"
      onPrimary={() => navigation.replace('ReportDetail', { reportId: p.reportId })}
      secondaryLabel="Back to home"
      onSecondary={() => navigation.popTo('Tabs', { screen: 'Home' })}
    />
  );
}
