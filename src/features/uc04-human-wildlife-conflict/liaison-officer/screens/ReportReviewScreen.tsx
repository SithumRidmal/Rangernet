import React, { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import {
  CheckCircle2Icon,
  CopyIcon,
  FileQuestionIcon,
  GaugeIcon,
  MapPinIcon,
  PhoneIcon,
  SirenIcon,
} from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  IconButton,
  KeyValue,
  LoadingBlock,
  MapPanel,
  Modal,
  Notice,
  OfflineBanner,
  PersonCard,
  PhotoThumb,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  useToast,
} from '@shared/components';
import { colors } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { getErrorMessage } from '@shared/utils/errors';
import { formatCoord, formatDateTime, relativeTime } from '@shared/utils/format';
import { useOfficer } from '../hooks/useOfficer';
import { useRemote } from '../hooks/useRemote';
import { fetchReport, resolveDuplicateFlag } from '../services/reportService';
import type { Severity } from '../services/rows';
import type { AssessedStatus, CommunityReport } from '../models/CommunityReport';
import { ReportPhoto } from '../models/ReportPhoto';
import { LoadError, RefreshError } from '../components/LoadState';
import { DuplicateBanner } from '../components/DuplicateBanner';
import { SeveritySheet } from '../components/SeveritySheet';
import { NoResponseSheet } from '../components/NoResponseSheet';
import { reportMarker } from '../components/ReportRecordCard';
import type { CloStackScreenProps } from '../navigation/types';

type Busy = 'assess' | 'status' | 'confirm' | 'clear' | null;

export function ReportReviewScreen({ route, navigation }: CloStackScreenProps<'ReportReview'>) {
  const { reportId } = route.params;
  const officer = useOfficer();
  const toast = useToast();
  const { online } = useSync();
  const { tick } = useNotifications();
  const { zoneName, parkName } = useLookups();
  const reviewRequested = useRef(false);

  const [sheet, setSheet] = useState<'severity' | 'noResponse' | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [preview, setPreview] = useState<ReportPhoto | null>(null);

  const load = useCallback(async () => {
    const report = await fetchReport(reportId);
    if (report && report.status === 'Reported' && !reviewRequested.current) {
      reviewRequested.current = true;
      try {
        await officer.reviewCommunityReport(report);
      } catch (e) {
        reviewRequested.current = false;
        toast.show(`Could not start the review: ${getErrorMessage(e)}`, 'warn');
      }
    }
    const original = report?.duplicateOf ? await fetchReport(report.duplicateOf).catch(() => null) : null;
    return { report, original };
  }, [reportId, officer, toast]);

  const { data, error, loading, refreshing, reload, refetch, retry } = useRemote(load, [reportId, tick], reportId);
  const report = data?.report ?? null;
  const original = data?.original ?? null;

  const run = async (key: Exclude<Busy, null>, action: () => Promise<void>, success: string, tone: 'ok' | 'warn' = 'ok') => {
    if (!online) {
      toast.show('You are offline. Reconnect to update this report.', 'warn');
      return false;
    }
    setBusy(key);
    try {
      await action();
      toast.show(success, tone);
      await refetch();
      return true;
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const assess = async (r: CommunityReport, severity: Severity, isHighRisk: boolean, note: string) => {
    const ok = await run(
      'assess',
      async () => {
        await officer.assessConflictSeverity(r, severity, isHighRisk, note);
      },
      isHighRisk ? `Marked as high risk (${severity}). Coordinate a response.` : `Severity assessed as ${severity}`,
      isHighRisk ? 'warn' : 'ok',
    );
    if (ok) setSheet(null);
  };

  const storeStatus = async (r: CommunityReport, status: AssessedStatus, note: string) => {
    const ok = await run('status', () => r.updateStatus(status, note), `Report ${status.toLowerCase()} – no field response required`);
    if (ok) setSheet(null);
  };

  const resolveDuplicate = async (r: CommunityReport, isDuplicate: boolean) => {
    const ok = await run(
      isDuplicate ? 'confirm' : 'clear',
      () => resolveDuplicateFlag(r.reportId, isDuplicate),
      isDuplicate ? `${r.code} marked as duplicate` : 'Duplicate flag cleared – continue the review',
    );
    if (ok) setConfirmDuplicate(false);
  };

  const call = (number: string) => {
    Linking.openURL(`tel:${number.replace(/[^\d+]/g, '')}`).catch(() => toast.show('Calling is not available on this device', 'warn'));
  };

  const contact = report?.reporterContact ?? null;
  const marker = report ? reportMarker(report) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title="Review report"
        subtitle={report ? `${report.code} · ${report.conflictType.getTypeName()}` : 'Community conflict report'}
        right={contact ? <IconButton icon={PhoneIcon} label="Call reporter" onPress={() => call(contact)} /> : undefined}
      />
      <OfflineBanner />
      <Screen padded={false} onRefresh={reload} refreshing={refreshing}>
        {loading ? (
          <LoadingBlock label="Loading report…" />
        ) : error && !data ? (
          <View style={{ padding: 16 }}>
            <LoadError error={error} onRetry={retry} title="Couldn't load this report" />
          </View>
        ) : !report ? (
          <EmptyState
            icon={FileQuestionIcon}
            title="Report not found"
            message="It may have been removed or you no longer have access to it."
            actionLabel="Go back"
            onAction={() => navigation.goBack()}
          />
        ) : (
          <>
            {marker ? <MapPanel height={170} rounded={false} markers={[marker]} /> : null}
            <View style={{ padding: 16 }}>
              {error ? <RefreshError error={error} onRetry={reload} /> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {report.badges().map((b) => (
                  <StatusBadge key={b} status={b} />
                ))}
                {report.isHighRisk && report.severity ? <StatusBadge status={report.severity} /> : null}
              </View>
              <AppText size={18} weight="semibold" style={{ marginTop: 10 }}>
                {report.conflictType.getTypeName()}
              </AppText>
              <AppText size={13} color={colors.muted} style={{ marginTop: 2 }}>
                Reported {relativeTime(report.reportedAt)} via {report.reportChannel === 'SMS' ? 'SMS' : 'the app'}
              </AppText>

              {!marker ? (
                <Notice
                  tone="info"
                  icon={MapPinIcon}
                  title="Location described by reporter"
                  message={report.location?.location_description || 'No location details were provided.'}
                  style={{ marginTop: 12 }}
                />
              ) : null}

              {report.isPossibleDuplicate ? (
                <View style={{ marginTop: 14 }}>
                  <DuplicateBanner
                    original={original}
                    busy={busy === 'confirm' || busy === 'clear' ? busy : null}
                    disabled={!online}
                    onOpenOriginal={() => original && navigation.push('ReportReview', { reportId: original.reportId })}
                    onConfirm={() => setConfirmDuplicate(true)}
                    onClear={() => resolveDuplicate(report, false)}
                  />
                </View>
              ) : report.status === 'Duplicate' ? (
                <Notice
                  tone="default"
                  icon={CopyIcon}
                  title="Confirmed duplicate"
                  message={
                    original
                      ? `Duplicate of ${original.code}. The response is handled on the original report.`
                      : 'The response is handled on the original report.'
                  }
                  action={original ? `Open ${original.code}` : undefined}
                  onAction={() => original && navigation.push('ReportReview', { reportId: original.reportId })}
                  style={{ marginTop: 14 }}
                />
              ) : null}

              <Card style={{ marginTop: 14, padding: 16 }}>
                <KeyValue
                  items={[
                    { label: 'Reported by', value: report.reporterName },
                    { label: 'Village', value: report.village ?? '—' },
                    {
                      label: 'Contact',
                      value: contact ? (
                        <Pressable onPress={() => call(contact)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <PhoneIcon size={13} color={colors.forest500} />
                          <AppText size={14} weight="semibold" color={colors.forest500}>
                            {contact}
                          </AppText>
                        </Pressable>
                      ) : (
                        '—'
                      ),
                    },
                    { label: 'Channel', value: <StatusBadge status={report.reportChannel} size="sm" /> },
                    { label: 'Reported at', value: formatDateTime(report.reportedAt) },
                    { label: 'Zone', value: zoneName(report.zoneId) ?? '—' },
                    { label: 'Park', value: report.parkId ? parkName(report.parkId) : '—' },
                    {
                      label: 'Location',
                      value: marker
                        ? `${formatCoord(report.location?.latitude, report.location?.longitude)}${report.location?.manually_marked ? ' (marked)' : ' (GPS)'}`
                        : 'Description only',
                    },
                    ...(report.isOffline ? [{ label: 'Submitted', value: 'Stored offline, synced later' }] : []),
                    ...(marker && report.location?.location_description
                      ? [{ label: 'Location notes', value: report.location.location_description }]
                      : []),
                  ]}
                />
              </Card>

              <SectionHeader title="Description" style={{ marginTop: 20 }} />
              <Card style={{ padding: 16 }}>
                <AppText size={14} lineHeight={21}>
                  {report.description}
                </AppText>
              </Card>

              <SectionHeader title={`Photos (${report.photos.length})`} style={{ marginTop: 20 }} />
              {report.photos.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {report.photos.map((p, i) => (
                    <PhotoThumb key={p.photoId} bucket={ReportPhoto.bucket} path={p.photoPath} index={i} size={96} onPress={() => setPreview(p)} />
                  ))}
                </ScrollView>
              ) : (
                <AppText size={13} color={colors.muted}>
                  No photos were attached to this report.
                </AppText>
              )}

              <SectionHeader title="Assessment" style={{ marginTop: 20 }} />
              <Card style={{ padding: 16 }}>
                {report.isAssessed ? (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      <StatusBadge status={report.severity ?? 'Low'} />
                      {report.isHighRisk ? <StatusBadge status="High Risk" /> : <StatusBadge status="Reviewed" />}
                    </View>
                    <AppText size={13} lineHeight={19} style={{ marginTop: 10 }}>
                      {report.assessmentNote || 'No assessment note.'}
                    </AppText>
                    <AppText size={12} color={colors.muted} style={{ marginTop: 6 }}>
                      Assessed {formatDateTime(report.reviewedAt)}
                    </AppText>
                  </>
                ) : (
                  <AppText size={13} color={colors.muted} lineHeight={19}>
                    Not assessed yet. Assess the severity to decide whether a ranger response is needed.
                  </AppText>
                )}
              </Card>

              {report.assignment ? (
                <>
                  <SectionHeader
                    title="Ranger response"
                    action="Track"
                    onAction={() => report.assignment?.assignmentId && navigation.push('ResponseTracking', { assignmentId: report.assignment.assignmentId })}
                    style={{ marginTop: 20 }}
                  />
                  <PersonCard
                    name={report.assignment.rangerName}
                    subtitle={`Assigned ${relativeTime(report.assignment.assignedAt)}`}
                    detail={report.assignment.instructions ?? undefined}
                    status={report.assignment.responseStatus}
                    onPress={() =>
                      report.assignment?.assignmentId && navigation.push('ResponseTracking', { assignmentId: report.assignment.assignmentId })
                    }
                  />
                </>
              ) : report.status === 'Resolved' || report.status === 'Closed' ? (
                <Notice
                  tone="ok"
                  icon={CheckCircle2Icon}
                  title={`No field response required · ${report.status}`}
                  message="The assessed status was stored and the reporter was notified."
                  style={{ marginTop: 20 }}
                />
              ) : null}
            </View>
          </>
        )}
      </Screen>

      {report ? <Footer report={report} online={online} onAssess={() => setSheet('severity')} onNoResponse={() => setSheet('noResponse')} navigation={navigation} /> : null}

      {report ? (
        <>
          <SeveritySheet
            open={sheet === 'severity'}
            report={report}
            busy={busy === 'assess'}
            disabled={!online}
            onClose={() => setSheet(null)}
            onSubmit={(s, hr, note) => assess(report, s, hr, note)}
          />
          <NoResponseSheet
            open={sheet === 'noResponse'}
            busy={busy === 'status'}
            disabled={!online}
            onClose={() => setSheet(null)}
            onSubmit={(status, note) => storeStatus(report, status, note)}
          />
          <Modal
            open={confirmDuplicate}
            onClose={() => setConfirmDuplicate(false)}
            icon={CopyIcon}
            tone="warn"
            title="Confirm duplicate?"
            description={`${report.code} will be stored as a duplicate${original ? ` of ${original.code}` : ''}. No separate response will be coordinated for it.`}
            actions={
              <>
                <Button full variant="warning" loading={busy === 'confirm'} onPress={() => resolveDuplicate(report, true)}>
                  Confirm duplicate
                </Button>
                <Button full variant="ghost" onPress={() => setConfirmDuplicate(false)}>
                  Cancel
                </Button>
              </>
            }
          />
        </>
      ) : null}

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Report photo"
        description={preview ? `Captured ${formatDateTime(preview.capturedAt)}` : undefined}
        actions={
          <Button full variant="outline" onPress={() => setPreview(null)}>
            Close
          </Button>
        }
      >
        {preview ? (
          <View style={{ alignItems: 'center' }}>
            <PhotoThumb bucket={ReportPhoto.bucket} path={preview.photoPath} size={280} />
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function Footer({
  report,
  online,
  onAssess,
  onNoResponse,
  navigation,
}: {
  report: CommunityReport;
  online: boolean;
  onAssess: () => void;
  onNoResponse: () => void;
  navigation: CloStackScreenProps<'ReportReview'>['navigation'];
}) {
  const assignmentId = report.assignment?.assignmentId ?? null;
  const track = () => assignmentId && navigation.push('ResponseTracking', { assignmentId });

  if (report.isPossibleDuplicate) return null;

  if (!report.isOpen) {
    return assignmentId ? (
      <StickyFooter>
        <Button full size="lg" variant="outline" icon={SirenIcon} onPress={track}>
          View response
        </Button>
      </StickyFooter>
    ) : null;
  }

  if (report.status === 'Responding' && report.assignment?.isActive) {
    return (
      <StickyFooter>
        <Button full size="lg" icon={SirenIcon} onPress={track}>
          Track response
        </Button>
      </StickyFooter>
    );
  }

  if (!report.isAssessed) {
    return (
      <StickyFooter>
        <Button full size="lg" icon={GaugeIcon} disabled={!online} onPress={onAssess}>
          Assess severity
        </Button>
      </StickyFooter>
    );
  }

  return (
    <StickyFooter>
      {report.isHighRisk ? (
        <Button full size="lg" icon={SirenIcon} disabled={!online} onPress={() => navigation.push('AssignRanger', { reportId: report.reportId })}>
          Coordinate response
        </Button>
      ) : (
        <Button full size="lg" icon={CheckCircle2Icon} disabled={!online} onPress={onNoResponse}>
          No field response required
        </Button>
      )}
      <Button full variant="ghost" icon={GaugeIcon} disabled={!online} onPress={onAssess}>
        Reassess severity
      </Button>
    </StickyFooter>
  );
}
