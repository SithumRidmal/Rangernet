import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CloudOffIcon, CopyIcon, FileQuestionIcon, InfoIcon, SirenIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BellButton,
  Card,
  EmptyState,
  KeyValue,
  LoadingBlock,
  Notice,
  OfflineBanner,
  PhotoThumb,
  Screen,
  SectionHeader,
  StatusBadge,
  Timeline,
  useToast,
  type TimelineEntry,
} from '@shared/components';
import { env } from '@shared/config/env';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { formatDateTime, relativeTime } from '@shared/utils/format';
import type { CommunityReport } from '../models/CommunityReport';
import { useReportDetail } from '../services/useMyReports';
import type { ReportStatus } from '../services/types';
import { LocationSummary } from '../components/LocationSummary';
import { reportCode } from '../components/ReportListCard';
import type { CommunityStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ReportDetail'>;

const LEVEL: Record<ReportStatus, number> = {
  Reported: 0,
  'Under Review': 1,
  Responding: 2,
  Resolved: 3,
  Closed: 3,
  Duplicate: 3,
};

function buildTimeline(r: CommunityReport): TimelineEntry[] {
  const level = LEVEL[r.status];
  const a = r.assignment;
  const finalLabel = r.status === 'Closed' ? 'Closed' : r.status === 'Duplicate' ? 'Marked as duplicate' : 'Resolved';
  const finalTime = a?.resolved_at ?? (level >= 3 ? r.updatedAt : null);
  return [
    {
      label: 'Reported',
      detail: r.reportChannel === 'SMS' ? 'Received by SMS' : r.isOffline ? 'Saved offline, then synchronized' : 'Submitted in the app',
      time: formatDateTime(r.reportedAt),
      done: true,
    },
    {
      label: 'Under Review',
      detail: 'A Community Liaison Officer reviews the report',
      time: r.reviewedAt ? formatDateTime(r.reviewedAt) : '',
      done: level >= 1 || !!r.reviewedAt,
    },
    {
      label: 'Responding',
      detail: a ? `Ranger assigned · ${a.response_status}` : level >= 3 ? 'No field response was needed' : 'Waiting for the officer’s decision',
      time: a ? formatDateTime(a.assigned_at) : '',
      done: !!a,
      tone: r.isHighRisk ? 'critical' : 'default',
    },
    { label: finalLabel, time: finalTime ? formatDateTime(finalTime) : '', done: level >= 3, tone: 'ok' },
  ];
}

export function ReportDetailScreen({ route }: Props) {
  const { state, loading, refreshing, error, refresh } = useReportDetail(route.params.reportId);
  const { online, syncNow } = useSync();
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const sendNow = async (includeFailed: boolean) => {
    setSending(true);
    try {
      const result = await syncNow(includeFailed);
      if (result.offline) toast.show('Still offline – the report stays on this device.', 'warn');
      else if (result.synced) toast.show('Report sent', 'ok');
      else toast.show('The report could not be sent yet. It will be retried automatically.', 'warn');
    } catch {
      toast.show('The report could not be sent yet. It will be retried automatically.', 'warn');
    } finally {
      setSending(false);
      refresh();
    }
  };

  if (!state) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Conflict report" right={<BellButton />} />
        <OfflineBanner />
        {loading ? (
          <LoadingBlock label="Loading report…" />
        ) : (
          <EmptyState
            icon={FileQuestionIcon}
            tone="critical"
            title="Report not available"
            message={error ?? 'This report could not be loaded.'}
            actionLabel="Try again"
            onAction={refresh}
          />
        )}
      </View>
    );
  }

  const r = state.report;
  const local = state.kind === 'local';
  const failed = local && state.outbox.status === 'failed';
  const typeName = r.conflictType?.getTypeName() ?? 'Conflict report';

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title={local ? 'Pending report' : reportCode(r.reportNo)} subtitle={typeName} right={<BellButton />} />
      <OfflineBanner />
      <Screen onRefresh={refresh} refreshing={refreshing}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {local ? (
            <StatusBadge status={failed ? 'Failed' : 'Pending Sync'} />
          ) : (
            <>
              <StatusBadge status={r.status} />
              <StatusBadge status={r.reportChannel} size="sm" dot={false} />
              {r.severity ? <StatusBadge status={r.severity} size="sm" /> : null}
              {r.isHighRisk ? <StatusBadge status="High Risk" size="sm" /> : null}
            </>
          )}
        </View>
        <AppText size={18} weight="semibold" style={{ marginTop: 10 }}>
          {typeName}
        </AppText>
        <AppText size={13} color={colors.muted}>
          Reported {formatDateTime(r.reportedAt)}
        </AppText>

        {local && !failed ? (
          <Notice
            tone="warn"
            icon={CloudOffIcon}
            title="Pending Synchronization"
            message={`Saved on this device ${relativeTime(state.outbox.createdAt)}. It will be sent automatically when you are back online.`}
            action={online ? (sending ? 'Sending…' : 'Send now') : undefined}
            onAction={sending ? undefined : () => sendNow(false)}
            style={{ marginTop: 14 }}
          />
        ) : null}
        {failed ? (
          <Notice
            tone="critical"
            icon={TriangleAlertIcon}
            title="The report could not be sent"
            message={`${state.outbox.lastError ?? 'The server rejected the report.'} It is kept on this device.`}
            action={sending ? 'Retrying…' : 'Retry now'}
            onAction={sending ? undefined : () => sendNow(true)}
            style={{ marginTop: 14 }}
          />
        ) : null}
        {state.kind === 'server' && state.cached ? (
          <Notice tone="info" icon={InfoIcon} message="You are viewing a copy saved on this device. Pull down to refresh when online." style={{ marginTop: 14 }} />
        ) : null}
        {!local && r.flaggedDuplicate && r.status !== 'Duplicate' ? (
          <Notice
            tone="warn"
            icon={CopyIcon}
            title="Flagged as a possible duplicate"
            message="A similar report was made near this place recently. A Community Liaison Officer will review it so the same situation does not get two responses."
            style={{ marginTop: 14 }}
          />
        ) : null}
        {!local && r.status === 'Duplicate' ? (
          <Notice
            tone="info"
            icon={CopyIcon}
            title="Confirmed duplicate"
            message="The officer confirmed that this report describes the same situation as an earlier report. The response is handled under that report."
            style={{ marginTop: 14 }}
          />
        ) : null}

        <Card style={{ padding: 16, marginTop: 14 }}>
          <KeyValue
            items={[
              { label: 'Report', value: local ? 'Assigned after sync' : reportCode(r.reportNo) },
              { label: 'Channel', value: r.reportChannel === 'SMS' ? 'SMS' : 'App' },
              { label: 'Severity', value: local ? 'Not assessed yet' : r.assessSeverity() },
              { label: 'Photos', value: r.photos.length ? String(r.photos.length) : 'None' },
            ]}
          />
        </Card>

        {!local ? (
          <>
            <SectionHeader title="Progress" style={{ marginTop: 20 }} />
            <Card style={{ padding: 16 }}>
              <Timeline entries={buildTimeline(r)} />
            </Card>
          </>
        ) : null}

        {!local && r.assignment ? (
          <>
            <SectionHeader title="Ranger response" style={{ marginTop: 20 }} />
            <Card style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.critBg, alignItems: 'center', justifyContent: 'center' }}>
                  <SirenIcon size={18} color={colors.crit} />
                </View>
                <AppText size={14} weight="semibold" style={{ flex: 1 }}>
                  A ranger was assigned
                </AppText>
                <StatusBadge status={r.assignment.response_status} size="sm" />
              </View>
              <KeyValue
                items={[
                  { label: 'Assigned', value: formatDateTime(r.assignment.assigned_at) },
                  { label: 'Acknowledged', value: formatDateTime(r.assignment.acknowledged_at) },
                  { label: 'Resolved', value: formatDateTime(r.assignment.resolved_at) },
                ]}
              />
              {r.assignment.response_notes ? (
                <AppText size={13} color={colors.muted} lineHeight={19} style={{ marginTop: 12 }}>
                  {r.assignment.response_notes}
                </AppText>
              ) : null}
            </Card>
          </>
        ) : null}

        {!local && r.assessmentNote ? (
          <>
            <SectionHeader title="Officer's note" style={{ marginTop: 20 }} />
            <Card style={{ padding: 16 }}>
              <AppText size={14} lineHeight={21}>
                {r.assessmentNote}
              </AppText>
            </Card>
          </>
        ) : null}

        <SectionHeader title="Description" style={{ marginTop: 20 }} />
        <Card style={{ padding: 16 }}>
          <AppText size={14} lineHeight={21}>
            {r.description}
          </AppText>
        </Card>

        <SectionHeader title={`Photos (${r.photos.length})`} style={{ marginTop: 20 }} />
        {r.photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {r.photos.map((p, i) =>
              p.isLocal() ? (
                <PhotoThumb key={p.photoId} uri={p.photoPath} index={i} size={96} />
              ) : (
                <PhotoThumb key={p.photoId} bucket={env.reportPhotoBucket} path={p.photoPath} index={i} size={96} />
              ),
            )}
          </ScrollView>
        ) : (
          <AppText size={13} color={colors.muted}>
            No photo was attached.
          </AppText>
        )}

        <SectionHeader title="Location" style={{ marginTop: 20 }} />
        <Card style={{ padding: 14, marginBottom: 8 }}>
          {r.location && (r.location.hasCoordinates() || r.location.locationDescription) ? (
            <LocationSummary location={r.location} mapHeight={180} />
          ) : (
            <AppText size={13} color={colors.muted}>
              No location was provided.
            </AppText>
          )}
        </Card>
      </Screen>
    </View>
  );
}
