import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { CloudOffIcon, InfoIcon, MessageSquareIcon, PhoneIcon, SearchXIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  KeyValue,
  ListRow,
  LoadingBlock,
  MapPanel,
  Notice,
  OfflineBanner,
  PhotoThumb,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  Timeline,
  useToast,
} from '@shared/components';
import { colors } from '@shared/theme';
import { env } from '@shared/config/env';
import { useProfile } from '@shared/auth/AuthProvider';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { getErrorMessage } from '@shared/utils/errors';
import { formatCode, formatCoord, formatDateTime } from '@shared/utils/format';
import { ResponseAssignment } from '../../models/ResponseAssignment';
import type { ResponseStatus } from '@navigation/ranger/CentralOperationsSystem';
import { rangerRepository } from '@navigation/ranger/rangerRepository';
import { useReloadable, type Fetched } from '@navigation/ranger/useReloadable';
import { pendingResponseUpdates, recordResponseStatus, type PendingResponseUpdate } from '../../services/responseService';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

const ACTION_LABEL: Record<ResponseStatus, string> = {
  Acknowledged: 'Acknowledge',
  Responding: 'Start responding',
  Resolved: 'Mark as resolved',
};

type Contact = { full_name: string; contact_number: string | null; village: string | null };
type Loaded = { assignment: ResponseAssignment | null; pending: PendingResponseUpdate | null; contact: Contact | null };

/** UC-04 sequence (high risk): notify ranger -> ranger acknowledges -> coordinate field response -> update response status. */
export function ResponseDetailScreen({ route }: RangerScreenProps<'ResponseDetail'>) {
  const { assignmentId } = route.params;
  const profile = useProfile();
  const toast = useToast();
  const { conflictTypeName } = useLookups();
  const { version } = useSync();
  const { tick } = useNotifications();
  const [sheet, setSheet] = useState<ResponseStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetcher = useCallback(async (): Promise<Fetched<Loaded | null>> => {
    const [res, pend] = await Promise.all([rangerRepository.assignment(profile.id, assignmentId), pendingResponseUpdates()]);
    if (!res.data) return { data: { assignment: null, pending: null, contact: null }, fromCache: res.fromCache };
    const p = pend.get(assignmentId) ?? null;
    const memberId = res.data.report?.member_id;
    const contact = memberId && !res.fromCache ? await rangerRepository.memberContact(memberId).catch(() => null) : null;
    return { data: { assignment: new ResponseAssignment(res.data, p?.status), pending: p, contact }, fromCache: res.fromCache };
  }, [assignmentId, profile.id]);
  const { data, fromCache, error, loading, reload: load } = useReloadable(fetcher, null, `${version}:${tick}`);
  const assignment = data?.assignment ?? null;
  const pending = data?.pending ?? null;
  const contact = data?.contact ?? null;

  if (data && !assignment) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Response" />
        <EmptyState icon={SearchXIcon} title="Response not found" message="This assignment may have been reassigned to another ranger." />
      </View>
    );
  }
  if (!assignment) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Response" />
        {error ? (
          <EmptyState icon={TriangleAlertIcon} tone="critical" title="Could not load the response" message={error} actionLabel="Retry" onAction={load} />
        ) : (
          <LoadingBlock label="Loading response…" />
        )}
      </View>
    );
  }

  const a = assignment;
  const r = a.row.report;
  const next = a.nextStatus();
  const lat = r?.location?.latitude ?? null;
  const lng = r?.location?.longitude ?? null;
  const order: Record<string, number> = { Assigned: 0, Acknowledged: 1, Responding: 2, Resolved: 3 };
  const rank = order[a.responseStatus] ?? 0;

  const submit = async () => {
    if (!sheet) return;
    setSaving(true);
    try {
      const outcome = await recordResponseStatus({
        ownerId: profile.id,
        assignmentId: a.assignmentId,
        reportNo: r?.report_no ?? null,
        status: sheet,
        notes: notes.trim() || null,
      });
      a.updateResponseStatus(sheet);
      setSheet(null);
      setNotes('');
      if (outcome.failedMessage) toast.show(outcome.failedMessage, 'critical');
      else toast.show(outcome.delivered ? `Response ${sheet.toLowerCase()}` : 'Saved on this device - will sync when online', outcome.delivered ? 'ok' : 'warn');
      await load();
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title={r ? formatCode('CR', r.report_no) : 'Response'} subtitle={r ? conflictTypeName(r.type_id) : undefined} />
      <OfflineBanner />
      <Screen padded={false} onRefresh={load} refreshing={loading}>
        {lat !== null && lng !== null ? (
          <MapPanel height={180} rounded={false} markers={[{ id: 'c', latitude: lat, longitude: lng, kind: 'conflict' }]} center={{ latitude: lat, longitude: lng }} showsUserLocation />
        ) : null}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <StatusBadge status={a.responseStatus} />
            {r?.is_high_risk ? <StatusBadge status="High Risk" size="sm" /> : null}
            {r?.severity ? <StatusBadge status={r.severity} size="sm" /> : null}
            {r ? <StatusBadge status={r.report_channel} size="sm" dot={false} /> : null}
            {pending ? <StatusBadge status={pending.failed ? 'Failed' : 'Pending Sync'} size="sm" /> : null}
          </View>
          <AppText size={18} weight="semibold" style={{ marginTop: 10 }}>
            {r ? conflictTypeName(r.type_id) : 'Conflict report'}
          </AppText>

          {pending?.failed ? (
            <Notice tone="critical" icon={TriangleAlertIcon} title="Status update rejected" message={pending.error ?? 'Open the Sync Center to retry.'} style={{ marginTop: 12 }} />
          ) : pending ? (
            <Notice tone="warn" icon={CloudOffIcon} message="Your latest status update is stored on this device and will sync automatically." style={{ marginTop: 12 }} />
          ) : fromCache ? (
            <Notice tone="warn" icon={CloudOffIcon} message="Offline copy - details may be out of date." style={{ marginTop: 12 }} />
          ) : null}

          {a.row.instructions ? (
            <Notice tone="info" icon={InfoIcon} title="Instructions from the Community Liaison Officer" message={a.row.instructions} style={{ marginTop: 12 }} />
          ) : null}

          <Card style={{ padding: 16, marginTop: 12 }}>
            <KeyValue
              items={[
                { label: 'Reported', value: r ? formatDateTime(r.reported_at) : '—' },
                { label: 'Assigned', value: formatDateTime(a.assignedAt) },
                { label: 'Location', value: lat !== null ? formatCoord(lat, lng) : (r?.location?.location_description ?? '—') },
                { label: 'Report status', value: r?.status ?? '—' },
              ]}
            />
            {r?.location?.location_description && lat !== null ? (
              <AppText size={12} color={colors.muted} style={{ marginTop: 10 }}>
                {r.location.location_description}
              </AppText>
            ) : null}
          </Card>

          <View style={{ marginTop: 18 }}>
            <SectionHeader title="Report" />
            <Card style={{ padding: 14 }}>
              <AppText size={14} lineHeight={21}>
                {r?.description || 'No description provided.'}
              </AppText>
              {r?.photos?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                  {r.photos.map((p, i) => (
                    <PhotoThumb key={p.photo_id} bucket={env.reportPhotoBucket} path={p.photo_path} index={i} size={84} />
                  ))}
                </View>
              ) : null}
            </Card>
          </View>

          <View style={{ marginTop: 18 }}>
            <SectionHeader title="Contacts" />
            <Card>
              {contact ? (
                <ListRow
                  icon={PhoneIcon}
                  title={contact.full_name || 'Community member'}
                  subtitle={[contact.village, contact.contact_number].filter(Boolean).join(' · ') || 'No phone number'}
                  onPress={contact.contact_number ? () => void Linking.openURL(`tel:${contact.contact_number}`) : undefined}
                />
              ) : r?.sms_sender ? (
                <ListRow icon={MessageSquareIcon} title="SMS reporter" subtitle={r.sms_sender} onPress={() => void Linking.openURL(`tel:${r.sms_sender}`)} />
              ) : null}
              {a.row.officer ? (
                <ListRow
                  icon={PhoneIcon}
                  title={a.row.officer.full_name}
                  subtitle={`Community Liaison Officer${a.row.officer.contact_number ? ` · ${a.row.officer.contact_number}` : ''}`}
                  onPress={a.row.officer.contact_number ? () => void Linking.openURL(`tel:${a.row.officer?.contact_number}`) : undefined}
                />
              ) : null}
              {!contact && !r?.sms_sender && !a.row.officer ? <ListRow title="No contact details available" /> : null}
            </Card>
          </View>

          <View style={{ marginTop: 18 }}>
            <SectionHeader title="Response progress" />
            <Card style={{ padding: 16 }}>
              <Timeline
                entries={[
                  { label: 'Assigned to you', time: formatDateTime(a.assignedAt), done: true },
                  { label: 'Acknowledged', time: a.row.acknowledged_at ? formatDateTime(a.row.acknowledged_at) : '', done: rank >= 1 },
                  { label: 'Responding in the field', time: '', done: rank >= 2 },
                  { label: 'Resolved', detail: a.row.response_notes ?? undefined, time: a.row.resolved_at ? formatDateTime(a.row.resolved_at) : '', done: rank >= 3, tone: 'ok' },
                ]}
              />
            </Card>
          </View>
        </View>
      </Screen>

      {next ? (
        <StickyFooter>
          <Button full size="lg" onPress={() => setSheet(next)}>
            {ACTION_LABEL[next]}
          </Button>
        </StickyFooter>
      ) : null}

      <BottomSheet open={!!sheet} onClose={() => setSheet(null)} title={sheet ? ACTION_LABEL[sheet] : ''}>
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <AppText size={13} color={colors.muted} lineHeight={19}>
            {sheet === 'Acknowledged'
              ? 'Confirm you received this assignment. The Community Liaison Officer is notified.'
              : sheet === 'Responding'
                ? 'Let the Community Liaison Officer know you are responding in the field.'
                : 'Record the outcome. The report is marked Resolved and the community member is notified.'}
          </AppText>
          <Field label="Notes" hint={sheet === 'Resolved' ? 'What was done? (recommended)' : 'Optional'}>
            <Input multiline value={notes} onChangeText={setNotes} maxLength={500} placeholder="Add a short note" />
          </Field>
          <Button full loading={saving} onPress={() => void submit()}>
            {sheet ? ACTION_LABEL[sheet] : 'Save'}
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}
