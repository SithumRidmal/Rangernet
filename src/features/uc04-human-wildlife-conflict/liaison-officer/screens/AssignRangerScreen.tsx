import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BellRingIcon, CopyIcon, FileQuestionIcon, TriangleAlertIcon, UsersIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Notice,
  OfflineBanner,
  PersonCard,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  useToast,
} from '@shared/components';
import { colors } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { getErrorMessage } from '@shared/utils/errors';
import { formatCoord, relativeTime } from '@shared/utils/format';
import { useOfficer } from '../hooks/useOfficer';
import { useRemote } from '../hooks/useRemote';
import { fetchRangers, fetchReport, type RangerOption } from '../services/reportService';
import { LoadError } from '../components/LoadState';
import { reportPlace } from '../components/ReportRecordCard';
import type { CloStackScreenProps } from '../navigation/types';

export function AssignRangerScreen({ route, navigation }: CloStackScreenProps<'AssignRanger'>) {
  const { reportId } = route.params;
  const officer = useOfficer();
  const toast = useToast();
  const { online } = useSync();
  const { parkName, zoneName } = useLookups();
  const [selected, setSelected] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, error, loading, refreshing, reload, retry } = useRemote(
    async () => {
      const [report, rangers] = await Promise.all([fetchReport(reportId), fetchRangers()]);
      return { report, rangers };
    },
    [reportId],
  );
  const report = data?.report ?? null;
  const current = report?.assignment?.isActive ? report.assignment : null;
  const reassigning = current !== null;

  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && report) {
    setPrefilled(true);
    if (report.assignment?.instructions) setInstructions(report.assignment.instructions);
  }

  const rangers = useMemo(() => {
    const list = [...(data?.rangers ?? [])];
    const park = report?.parkId ?? null;
    return list.sort((a, b) => {
      const pa = park && a.parkId === park ? 0 : 1;
      const pb = park && b.parkId === park ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (a.activeResponses !== b.activeResponses) return a.activeResponses - b.activeResponses;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [data, report]);

  const blockedReason = !report
    ? null
    : !report.isOpen
      ? `This report is already ${report.status.toLowerCase()}. A response can't be coordinated.`
      : report.isPossibleDuplicate
        ? 'This report is flagged as a possible duplicate. Resolve the flag on the report before coordinating a response.'
        : null;

  const submit = async () => {
    if (!report || !selected) return;
    if (!online) {
      toast.show('You are offline. Reconnect to coordinate the response.', 'warn');
      return;
    }
    const ranger = rangers.find((r) => r.id === selected);
    setSubmitting(true);
    try {
      const assignment = await officer.coordinateResponse(report, selected, instructions);
      if (!assignment.assignmentId) throw new Error('The response could not be created.');
      navigation.replace('ResponseCoordinated', {
        assignmentId: assignment.assignmentId,
        reportCode: report.code,
        rangerName: ranger?.fullName ?? 'Ranger',
        assignedAt: assignment.assignedAt ?? new Date().toISOString(),
        reassigned: reassigning,
      });
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
    } finally {
      setSubmitting(false);
    }
  };

  const describe = (r: RangerOption) =>
    r.activeResponses === 0 ? 'No active responses' : `${r.activeResponses} active response${r.activeResponses === 1 ? '' : 's'}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title={reassigning ? 'Reassign ranger' : 'Coordinate response'}
        subtitle={report ? `${report.code} · ${report.severity ?? 'Not assessed'}${report.isHighRisk ? ' · High risk' : ''}` : undefined}
      />
      <OfflineBanner />
      <Screen onRefresh={reload} refreshing={refreshing}>
        {loading ? (
          <LoadingBlock label="Loading rangers…" />
        ) : error && !data ? (
          <LoadError error={error} onRetry={retry} title="Couldn't load rangers" />
        ) : !report ? (
          <EmptyState icon={FileQuestionIcon} title="Report not found" message="It may have been removed or you no longer have access to it." />
        ) : (
          <>
            <Card style={{ padding: 14 }}>
              <AppText size={12} weight="semibold" color={colors.forest600}>
                {report.code}
              </AppText>
              <AppText size={15} weight="semibold" style={{ marginTop: 2 }}>
                {report.conflictType.getTypeName()}
              </AppText>
              <AppText size={12} color={colors.muted} style={{ marginTop: 2 }} numberOfLines={1}>
                {reportPlace(report, zoneName)}
                {report.hasCoordinates ? ` · ${formatCoord(report.location?.latitude, report.location?.longitude)}` : ''}
              </AppText>
              <AppText size={13} numberOfLines={3} style={{ marginTop: 8 }} lineHeight={19}>
                {report.description}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {report.severity ? <StatusBadge status={report.severity} size="sm" /> : null}
                {report.isHighRisk ? <StatusBadge status="High Risk" size="sm" /> : null}
                <StatusBadge status={report.status} size="sm" />
              </View>
            </Card>

            {blockedReason ? (
              <Notice
                tone={report.isPossibleDuplicate ? 'warn' : 'critical'}
                icon={report.isPossibleDuplicate ? CopyIcon : TriangleAlertIcon}
                message={blockedReason}
                action="Open report"
                onAction={() => navigation.goBack()}
                style={{ marginTop: 12 }}
              />
            ) : (
              <Notice
                tone="info"
                icon={BellRingIcon}
                message={
                  reassigning
                    ? 'The new ranger is notified and the response restarts as Assigned.'
                    : 'The report is marked as high risk and the selected ranger is notified to acknowledge and respond.'
                }
                style={{ marginTop: 12 }}
              />
            )}

            {current ? (
              <Card style={{ marginTop: 12, padding: 14 }}>
                <AppText size={13} weight="medium">
                  Currently assigned
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <AppText size={13} color={colors.muted} style={{ flex: 1 }} numberOfLines={1}>
                    {current.rangerName} · since {relativeTime(current.assignedAt)}
                  </AppText>
                  <StatusBadge status={current.responseStatus} size="sm" />
                </View>
              </Card>
            ) : null}

            <SectionHeader title={reassigning ? 'Select new ranger' : 'Rangers'} style={{ marginTop: 20 }} />
            {rangers.length === 0 ? (
              <Card>
                <EmptyState icon={UsersIcon} title="No rangers found" message="No active ranger accounts are registered yet." />
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {rangers.map((r) => {
                  const isCurrent = current?.rangerId === r.id;
                  return (
                    <PersonCard
                      key={r.id}
                      name={r.fullName}
                      subtitle={`${r.employeeId ?? 'Ranger'} · ${r.parkId ? parkName(r.parkId) : 'No park set'}${isCurrent ? ' · current' : ''}`}
                      detail={describe(r)}
                      status={r.activeResponses === 0 ? 'Available' : undefined}
                      selectable
                      selected={selected === r.id}
                      onPress={() => setSelected(r.id)}
                    />
                  );
                })}
              </View>
            )}

            <SectionHeader title="Response details" style={{ marginTop: 20 }} />
            <Field label="Instructions for the ranger" hint="Sent to the ranger with the high-risk alert">
              <Input
                value={instructions}
                onChangeText={setInstructions}
                placeholder="e.g. Elephant near paddy fields east of the village. Contact the reporter on arrival."
                multiline
                maxLength={800}
              />
            </Field>
          </>
        )}
      </Screen>
      {report ? (
        <StickyFooter>
          <Button
            full
            size="lg"
            loading={submitting}
            disabled={!selected || !!blockedReason || !online}
            onPress={submit}
          >
            {reassigning ? 'Reassign ranger' : 'Coordinate response'}
          </Button>
        </StickyFooter>
      ) : null}
    </View>
  );
}
