import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { CheckCircle2Icon, FileQuestionIcon, FileTextIcon, PhoneIcon, RefreshCwIcon, UserRoundIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  IconButton,
  LoadingBlock,
  Notice,
  OfflineBanner,
  PersonCard,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  Timeline,
  useToast,
  type TimelineEntry,
} from '@shared/components';
import { colors } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { getErrorMessage } from '@shared/utils/errors';
import { formatDateTime, relativeTime } from '@shared/utils/format';
import { useRemote } from '../hooks/useRemote';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { fetchResponse } from '../services/reportService';
import type { ResponseStatus } from '../services/rows';
import { RESPONSE_FLOW, type ResponseAssignment } from '../models/ResponseAssignment';
import type { CommunityReport } from '../models/CommunityReport';
import { LoadError, RefreshError } from '../components/LoadState';
import { ResponseStatusSheet } from '../components/ResponseStatusSheet';
import { reportPlace } from '../components/ReportRecordCard';
import { stamp } from '../components/stamp';
import type { CloStackScreenProps } from '../navigation/types';

function buildTimeline(a: ResponseAssignment, r: CommunityReport): TimelineEntry[] {
  const step = RESPONSE_FLOW.indexOf(a.responseStatus);
  return [
    {
      label: 'Report received',
      detail: `${r.reportChannel} · ${r.reporterName}`,
      time: stamp(r.reportedAt),
      done: true,
    },
    {
      label: 'Assessed as high risk',
      detail: r.severity ? `${r.severity} severity${r.assessmentNote ? ` · ${r.assessmentNote}` : ''}` : undefined,
      time: stamp(r.reviewedAt),
      done: true,
      tone: 'critical',
    },
    {
      label: 'Ranger notified',
      detail: `${a.rangerName}${a.instructions ? ` · ${a.instructions}` : ''}`,
      time: stamp(a.assignedAt),
      done: true,
      tone: 'warn',
    },
    {
      label: 'Acknowledged',
      detail: step >= 1 ? `${a.rangerName} acknowledged the alert` : 'Waiting for the ranger',
      time: stamp(a.acknowledgedAt),
      done: step >= 1,
    },
    {
      label: 'Responding',
      detail: step >= 2 ? 'Field response in progress' : 'Pending',
      time: a.responseStatus === 'Responding' ? stamp(a.updatedAt) : '—',
      done: step >= 2,
    },
    {
      label: 'Resolved',
      detail: step >= 3 ? a.responseNotes || 'Conflict resolved' : 'Pending',
      time: stamp(a.resolvedAt),
      done: step >= 3,
      tone: 'ok',
    },
  ];
}

export function ResponseTrackingScreen({ route, navigation }: CloStackScreenProps<'ResponseTracking'>) {
  const { assignmentId } = route.params;
  const toast = useToast();
  const { online } = useSync();
  const { tick } = useNotifications();
  const { zoneName } = useLookups();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, refreshing, reload, refetch, retry } = useRemote(() => fetchResponse(assignmentId), [assignmentId, tick], assignmentId);
  useRealtimeRefresh(['response_assignments'], refetch);

  const assignment = data?.assignment ?? null;
  const report = data?.report ?? null;
  const rangerPhone = assignment?.ranger?.contact_number ?? null;

  const call = (number: string) => {
    Linking.openURL(`tel:${number.replace(/[^\d+]/g, '')}`).catch(() => toast.show('Calling is not available on this device', 'warn'));
  };

  const update = async (status: ResponseStatus, notes: string) => {
    if (!assignment) return;
    if (!online) {
      toast.show('You are offline. Reconnect to update the response.', 'warn');
      return;
    }
    setBusy(true);
    try {
      await assignment.updateResponseStatus(status, notes);
      toast.show(status === 'Resolved' ? 'Response resolved – report closed as Resolved' : `Response marked ${status}`, 'ok');
      setSheet(false);
      await refetch();
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
    } finally {
      setBusy(false);
    }
  };

  const resolved = assignment?.responseStatus === 'Resolved';

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title="Response tracking"
        subtitle={report ? `${report.code} · ${report.conflictType.getTypeName()}` : undefined}
        right={rangerPhone ? <IconButton icon={PhoneIcon} label="Call ranger" onPress={() => call(rangerPhone)} /> : undefined}
      />
      <OfflineBanner />
      <Screen onRefresh={reload} refreshing={refreshing}>
        {loading ? (
          <LoadingBlock label="Loading response…" />
        ) : error && !data ? (
          <LoadError error={error} onRetry={retry} title="Couldn't load this response" />
        ) : !assignment || !report ? (
          <EmptyState
            icon={FileQuestionIcon}
            title="Response not found"
            message="It may have been removed or you no longer have access to it."
            actionLabel="Go back"
            onAction={() => navigation.goBack()}
          />
        ) : (
          <>
            {error ? <RefreshError error={error} onRetry={reload} /> : null}
            <Card style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <StatusBadge status={assignment.responseStatus} />
                <AppText size={12} color={colors.muted}>
                  Assigned {relativeTime(assignment.assignedAt)}
                </AppText>
              </View>
            </Card>

            {resolved ? (
              <Notice
                tone="ok"
                icon={CheckCircle2Icon}
                title="Response resolved"
                message={`Resolved ${formatDateTime(assignment.resolvedAt)}. The report is stored as Resolved.`}
                style={{ marginTop: 12 }}
              />
            ) : null}

            <SectionHeader title="Assigned ranger" style={{ marginTop: 20 }} />
            <PersonCard
              name={assignment.rangerName}
              subtitle={[assignment.ranger?.employee_id, rangerPhone].filter(Boolean).join(' · ') || 'Ranger'}
              right={rangerPhone ? <IconButton icon={PhoneIcon} label="Call ranger" onPress={() => call(rangerPhone)} /> : undefined}
            />

            {assignment.instructions ? (
              <>
                <SectionHeader title="Instructions" style={{ marginTop: 20 }} />
                <Card style={{ padding: 16 }}>
                  <AppText size={14} lineHeight={21}>
                    {assignment.instructions}
                  </AppText>
                </Card>
              </>
            ) : null}

            <SectionHeader title="Response progress" style={{ marginTop: 20 }} />
            <Card style={{ padding: 16 }}>
              <Timeline entries={buildTimeline(assignment, report)} />
            </Card>

            {assignment.responseNotes ? (
              <>
                <SectionHeader title="Response notes" style={{ marginTop: 20 }} />
                <Card style={{ padding: 16 }}>
                  <AppText size={14} lineHeight={21}>
                    {assignment.responseNotes}
                  </AppText>
                </Card>
              </>
            ) : null}

            <SectionHeader
              title="Conflict report"
              action="Open report"
              onAction={() => navigation.push('ReportReview', { reportId: report.reportId })}
              style={{ marginTop: 20 }}
            />
            <Card onPress={() => navigation.push('ReportReview', { reportId: report.reportId })} style={{ padding: 14 }}>
              <AppText size={12} weight="semibold" color={colors.forest600}>
                {report.code}
              </AppText>
              <AppText size={14} weight="medium" style={{ marginTop: 2 }}>
                {report.conflictType.getTypeName()}
              </AppText>
              <AppText size={12} color={colors.muted} style={{ marginTop: 2 }}>
                {reportPlace(report, zoneName)} · {formatDateTime(report.reportedAt)}
              </AppText>
              <AppText size={13} numberOfLines={3} lineHeight={19} style={{ marginTop: 8 }}>
                {report.description}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                <StatusBadge status={report.status} size="sm" />
                {report.severity ? <StatusBadge status={report.severity} size="sm" /> : null}
                {report.isHighRisk ? <StatusBadge status="High Risk" size="sm" /> : null}
              </View>
            </Card>
          </>
        )}
      </Screen>

      {assignment && report ? (
        <StickyFooter>
          {resolved ? (
            <Button full size="lg" variant="outline" icon={FileTextIcon} onPress={() => navigation.push('ReportReview', { reportId: report.reportId })}>
              Open report
            </Button>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                variant="outline"
                size="lg"
                icon={UserRoundIcon}
                style={{ flex: 1 }}
                disabled={!online}
                onPress={() => navigation.push('AssignRanger', { reportId: report.reportId })}
              >
                Reassign
              </Button>
              <Button size="lg" icon={RefreshCwIcon} style={{ flex: 1 }} disabled={!online} onPress={() => setSheet(true)}>
                Update status
              </Button>
            </View>
          )}
        </StickyFooter>
      ) : null}

      {assignment && !resolved ? (
        <ResponseStatusSheet
          open={sheet}
          assignment={assignment}
          busy={busy}
          disabled={!online}
          onClose={() => setSheet(false)}
          onSubmit={update}
        />
      ) : null}
    </View>
  );
}
