import React from 'react';
import { RecordCard, type MapPoint } from '@shared/components';
import { relativeTime } from '@shared/utils/format';
import type { CommunityReport } from '../models/CommunityReport';

export function reportPlace(report: CommunityReport, zoneName: (id: string | null) => string | null): string {
  return report.village ?? zoneName(report.zoneId) ?? report.location?.location_description ?? 'Location not given';
}

export function reportMarker(report: CommunityReport, onPress?: () => void): MapPoint | null {
  const lat = report.location?.latitude;
  const lng = report.location?.longitude;
  if (lat == null || lng == null) return null;
  return {
    id: report.reportId,
    latitude: lat,
    longitude: lng,
    kind: report.isHighRisk ? 'incident' : 'conflict',
    label: `${report.code} · ${report.conflictType.getTypeName()}`,
    onPress,
  };
}

export function ReportRecordCard({
  report,
  place,
  subtitle,
  badges,
  onPress,
}: {
  report: CommunityReport;
  place: string;
  subtitle?: string;
  badges?: string[];
  onPress: () => void;
}) {
  return (
    <RecordCard
      code={report.code}
      title={report.conflictType.getTypeName()}
      subtitle={subtitle ?? `${place} · ${relativeTime(report.reportedAt)}`}
      badges={badges ?? report.badges()}
      thumbTone={report.isHighRisk ? 'critical' : report.isPossibleDuplicate ? 'warn' : 'default'}
      onPress={onPress}
    />
  );
}
