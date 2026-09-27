import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { CloudOffIcon, DatabaseIcon, PencilIcon, TriangleAlertIcon, UploadCloudIcon } from 'lucide-react-native';
import {
  AppText,
  Button,
  Card,
  KeyValue,
  MapPanel,
  Modal,
  Notice,
  PhotoThumb,
  Screen,
  SectionHeader,
  StatusBadge,
  StickyFooter,
  WizardHeader,
} from '@shared/components';
import { colors } from '@shared/theme';
import { useProfile } from '@shared/auth/AuthProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { LocalStorageError } from '@shared/sync/LocalStorage';
import { getErrorMessage } from '@shared/utils/errors';
import { formatCoord, formatDateTime } from '@shared/utils/format';
import { IncidentValidationError, MISSING_LABELS, type MissingField, type SubmitOutcome } from '../../models/Incident';
import { useIncidentDraft } from '../../incident/IncidentDraftContext';
import type { RangerScreenProps, RangerStackParamList } from '../../navigation/types';

type WizardRoute = 'IncidentType' | 'IncidentPhoto' | 'IncidentLocation' | 'IncidentDescription';

const FIX_ROUTE: Record<MissingField, WizardRoute> = {
  type: 'IncidentType',
  photo: 'IncidentPhoto',
  location: 'IncidentLocation',
  description: 'IncidentDescription',
};

/** UC-01 steps 8-12 with 8a (offline), 9a (missing information) and 11a (local storage failure). */
export function IncidentReviewScreen({ navigation }: RangerScreenProps<'IncidentReview'>) {
  const { incident, reset } = useIncidentDraft();
  const profile = useProfile();
  const { online } = useSync();
  const [submitting, setSubmitting] = useState(false);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  if (!incident) return null;
  const loc = incident.location;
  const point = loc && loc.latitude !== null && loc.longitude !== null ? { latitude: loc.latitude, longitude: loc.longitude } : null;

  const finish = (outcome: SubmitOutcome) => {
    const params: RangerStackParamList['IncidentSuccess'] = {
      incidentId: outcome.incidentId,
      incidentNo: outcome.kind === 'stored' ? outcome.incidentNo : null,
      pending: outcome.kind === 'pending',
      typeName: incident.type.getTypeName(),
      reportedAt: incident.reportedAt ?? new Date().toISOString(),
      photoCount: incident.photos.length,
    };
    const state = navigation.getState();
    const start = state.routes.findIndex((r) => r.name === 'IncidentType');
    const base = state.routes.slice(0, start < 0 ? state.routes.length : start);
    reset({ keepPhotos: true });
    navigation.dispatch(
      CommonActions.reset({
        index: base.length,
        routes: [...base.map((r) => ({ key: r.key, name: r.name, params: r.params })), { name: 'IncidentSuccess', params }],
      }),
    );
  };

  const submit = async () => {
    setError(null);
    if (!incident.validateIncident()) {
      setMissing(incident.missingInformation());
      return;
    }
    setMissing([]);
    setSubmitting(true);
    try {
      finish(await incident.submitIncident(profile.id));
    } catch (e) {
      if (e instanceof IncidentValidationError) setMissing(e.missing);
      else if (e instanceof LocalStorageError) setStorageError(e.message);
      else setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const retrySave = async () => {
    setSubmitting(true);
    try {
      const outcome = await incident.saveLocally(profile.id);
      setStorageError(null);
      finish(outcome);
    } catch (e) {
      setStorageError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const edit = (route: WizardRoute) => (
    <Pressable onPress={() => navigation.popTo(route)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <PencilIcon size={13} color={colors.forest500} />
      <AppText size={13} weight="semibold" color={colors.forest500}>
        Edit
      </AppText>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={5} total={5} title="Review incident" context={incident.type.getTypeName()} />
      <Screen>
        {missing.length > 0 ? (
          <Card style={{ padding: 14, marginBottom: 14, borderColor: 'rgba(216,74,74,0.4)' }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TriangleAlertIcon size={16} color={colors.crit} />
              <AppText size={14} weight="semibold" color={colors.crit}>
                Required information is missing
              </AppText>
            </View>
            {missing.map((m) => (
              <Pressable
                key={m}
                onPress={() => navigation.popTo(FIX_ROUTE[m])}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}
              >
                <AppText size={13}>• {MISSING_LABELS[m]}</AppText>
                <AppText size={13} weight="semibold" color={colors.forest500}>
                  Fix
                </AppText>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {error ? (
          <Notice tone="critical" icon={TriangleAlertIcon} title="Incident not accepted" message={error} style={{ marginBottom: 14 }} />
        ) : null}

        <Card style={{ overflow: 'hidden' }}>
          {point ? <MapPanel height={140} rounded={false} markers={[{ id: 'p', ...point, kind: 'incident' }]} center={point} /> : null}
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <StatusBadge status="Reported" size="sm" />
                {loc ? <StatusBadge status={loc.manuallyMarked ? 'Manual' : 'GPS'} size="sm" dot={false} /> : null}
              </View>
              {edit('IncidentLocation')}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <AppText size={17} weight="semibold">
                {incident.type.getTypeName()}
              </AppText>
              {edit('IncidentType')}
            </View>
            <View style={{ marginTop: 14 }}>
              <KeyValue
                items={[
                  { label: 'Date / time', value: formatDateTime(new Date()) },
                  { label: 'Reported by', value: profile.full_name || '—' },
                  { label: 'Location', value: point ? formatCoord(point.latitude, point.longitude) : 'Missing' },
                  { label: 'Employee ID', value: profile.employee_id ?? '—' },
                ]}
              />
            </View>
          </View>
        </Card>

        <View style={{ marginTop: 18 }}>
          <SectionHeader title="Description" />
          <Card style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>{edit('IncidentDescription')}</View>
            <AppText size={14} lineHeight={21} color={incident.description ? colors.ink : colors.muted}>
              {incident.description || 'No description entered'}
            </AppText>
          </Card>
        </View>

        <View style={{ marginTop: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <AppText size={16} weight="semibold">
              Photographs ({incident.photos.length})
            </AppText>
            {edit('IncidentPhoto')}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {incident.photos.map((p, i) => (
              <PhotoThumb key={p.photoId} uri={p.photoPath} index={i} size={84} />
            ))}
          </View>
        </View>

        <Notice
          tone={online ? 'info' : 'warn'}
          icon={online ? UploadCloudIcon : CloudOffIcon}
          title={online ? 'Connected' : 'No network connection'}
          message={
            online
              ? 'The incident will be sent to the Central Operations System and your supervisor notified.'
              : 'The incident will be saved on this device as Pending Synchronization and sent automatically when connectivity returns.'
          }
          style={{ marginTop: 18 }}
        />
      </Screen>
      <StickyFooter>
        <Button full size="lg" loading={submitting} onPress={() => void submit()}>
          Submit Incident
        </Button>
      </StickyFooter>

      <Modal
        open={!!storageError}
        onClose={() => setStorageError(null)}
        tone="critical"
        icon={DatabaseIcon}
        title="Could not save the incident"
        description={`${storageError ?? ''}\nYour report is still on this screen. Retry saving it to the device.`}
        actions={
          <>
            <Button full loading={submitting} onPress={() => void retrySave()}>
              Retry
            </Button>
            <Button full variant="ghost" onPress={() => setStorageError(null)}>
              Cancel
            </Button>
          </>
        }
      />
    </View>
  );
}
