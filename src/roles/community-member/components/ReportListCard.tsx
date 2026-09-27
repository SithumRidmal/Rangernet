import React from 'react';
import { RecordCard } from '@shared/components';
import { formatCode, relativeTime } from '@shared/utils/format';
import type { ReportListItem } from '../services/useMyReports';
import { locationText } from './LocationSummary';

export function reportCode(reportNo: number | null): string {
  return formatCode('CR', reportNo);
}

export function ReportListCard({ item, onPress }: { item: ReportListItem; onPress: () => void }) {
  const r = item.report;
  const badges =
    item.source === 'local'
      ? [item.outbox.status === 'failed' ? 'Failed' : 'Pending Sync']
      : [r.status, ...(r.flaggedDuplicate && r.status !== 'Duplicate' ? ['Possible Duplicate'] : []), r.reportChannel];
  const localThumb = item.source === 'local' ? r.photos.find((p) => p.existsOnDevice())?.photoPath ?? null : null;
  return (
    <RecordCard
      code={reportCode(r.reportNo)}
      title={r.conflictType?.getTypeName() ?? 'Conflict report'}
      subtitle={`${relativeTime(r.reportedAt)} · ${locationText(r.location)}`}
      badges={badges}
      thumbUri={localThumb}
      thumbTone={item.source === 'local' ? 'warn' : r.isHighRisk ? 'critical' : 'default'}
      onPress={onPress}
    />
  );
}
