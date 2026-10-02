import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  CloudOffIcon,
  EraserIcon,
  InfoIcon,
  MapPinIcon,
  SearchIcon,
  TriangleAlertIcon,
  Undo2Icon,
  UsersIcon,
} from 'lucide-react-native';
import {
  AppText,
  Button,
  Card,
  DEFAULT_CENTER,
  EmptyState,
  Field,
  FilterChips,
  Input,
  KeyValue,
  LoadingBlock,
  MapPanel,
  Notice,
  OfflineBanner,
  PersonCard,
  Screen,
  SectionHeader,
  StickyFooter,
  WizardHeader,
  useToast,
  type MapLine,
  type MapPoint,
} from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { formatCoord, formatDateTime, formatKm } from '@shared/utils/format';
import {
  AssignmentValidationError,
  PatrolRoute,
  parseDistance,
  type AssignmentErrors,
  type AssignmentField,
  type Patrol,
  type PatrolAssignmentInput,
} from '../models';
import { useSupervisor } from '../hooks/useSupervisor';
import { useRemoteData } from '../hooks/useRemoteData';
import { fetchRangerOverview } from '../services/rangerService';
import { RemoteStatus } from '../components/RemoteStatus';
import { DateTimeField } from '../components/DateTimeField';
import type { SupervisorScreenProps } from '../navigation/types';

type PlannedPoint = { latitude: number; longitude: number; note: string };

const STEPS = ['Select ranger', 'Plan route', 'Schedule & confirm'] as const;
const STEP_OF: Record<AssignmentField, number> = { ranger: 1, title: 2, park: 2, waypoints: 2, distance: 2, scheduledFor: 3 };
const NO_ZONE = 'none';

function nextFullHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export function PatrolFormScreen({ navigation, route: navRoute }: SupervisorScreenProps<'PatrolForm'>) {
  const patrolId = navRoute.params?.patrolId;
  const supervisor = useSupervisor();

  const loadPatrol = useCallback(
    () => (patrolId ? supervisor.viewPatrolCoverage(patrolId) : Promise.resolve(null)),
    [patrolId, supervisor],
  );
  const existing = useRemoteData<Patrol | null>(`sup:${supervisor.supervisorId}:form:${patrolId ?? 'new'}`, loadPatrol, {
    toCache: () => null,
    fromCache: () => null,
  });
  const { reload: reloadExisting } = existing;
  useEffect(() => {
    reloadExisting();
  }, [reloadExisting]);

  if (patrolId && !existing.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <WizardHeader step={1} total={3} title="Edit patrol route" context="Loading" />
        <OfflineBanner />
        <Screen>
          {existing.loading ? (
            <LoadingBlock label="Loading patrol…" />
          ) : (
            <EmptyState
              icon={TriangleAlertIcon}
              tone="critical"
              title="Could not load this patrol"
              message={existing.error ?? 'Please try again.'}
              actionLabel="Try again"
              onAction={existing.reload}
            />
          )}
        </Screen>
      </View>
    );
  }

  if (existing.data && !existing.data.canEditRoute()) {
    const p = existing.data;
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <WizardHeader step={1} total={3} title="Edit patrol route" context={p.getCode()} />
        <Screen>
          <Notice
            tone="warn"
            icon={TriangleAlertIcon}
            title={`${p.getCode()} is ${p.status.toLowerCase()}`}
            message="The route can only be updated before the ranger starts the patrol."
          />
          <View style={{ marginTop: 16 }}>
            <Button full variant="secondary" onPress={() => navigation.replace('PatrolDetail', { patrolId: p.patrolId })}>
              View patrol
            </Button>
          </View>
        </Screen>
      </View>
    );
  }

  return (
    <PatrolForm
      key={existing.data?.patrolId ?? 'new'}
      patrol={existing.data}
      initialRangerId={navRoute.params?.rangerId}
      initialZoneId={navRoute.params?.zoneId}
      navigation={navigation}
    />
  );
}

function PatrolForm({
  patrol,
  initialRangerId,
  initialZoneId,
  navigation,
}: {
  patrol: Patrol | null;
  initialRangerId?: string;
  initialZoneId?: string;
  navigation: SupervisorScreenProps<'PatrolForm'>['navigation'];
}) {
  const supervisor = useSupervisor();
  const toast = useToast();
  const { online } = useSync();
  const { parks, zones, parkName, zoneName } = useLookups();
  const editing = !!patrol;

  const [step, setStep] = useState(1);
  const [rangerId, setRangerId] = useState<string | null>(patrol?.rangerId ?? initialRangerId ?? null);
  const [title, setTitle] = useState(patrol?.title ?? '');
  const [parkId, setParkId] = useState<string | null>(
    patrol ? patrol.parkId : (zones.find((z) => z.zone_id === initialZoneId)?.park_id ?? supervisor.parkId),
  );
  const [zoneId, setZoneId] = useState<string | null>(patrol ? patrol.zoneId : (initialZoneId ?? null));
  const [scheduledFor, setScheduledFor] = useState<Date | null>(
    patrol?.scheduledFor ? new Date(patrol.scheduledFor) : patrol ? null : nextFullHour(),
  );
  const [instructions, setInstructions] = useState(patrol?.instructions ?? '');
  const [points, setPoints] = useState<PlannedPoint[]>(
    patrol?.getRoute().getPlannedWaypoints().map((w) => ({ latitude: w.latitude, longitude: w.longitude, note: w.note ?? '' })) ?? [],
  );
  const initialDistance = patrol?.getRoute().plannedDistanceKm;
  const [distanceText, setDistanceText] = useState(initialDistance != null ? String(initialDistance) : '');
  const [distanceEdited, setDistanceEdited] = useState(initialDistance != null);
  const [query, setQuery] = useState('');
  const [errors, setErrors] = useState<AssignmentErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const done = useRef(false);
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (done.current || stepRef.current === 1) return;
        e.preventDefault();
        setStep((s) => Math.max(1, s - 1));
      }),
    [navigation],
  );

  const loadRangers = useCallback(() => fetchRangerOverview(supervisor.parkId), [supervisor.parkId]);
  const rangers = useRemoteData(`sup:${supervisor.supervisorId}:rangers`, loadRangers);
  const { reload: reloadRangers } = rangers;
  useEffect(() => {
    reloadRangers();
  }, [reloadRangers]);

  const plannedRoute = useMemo(() => PatrolRoute.plan(points), [points]);
  const measuredKm = useMemo(() => plannedRoute.measurePlannedDistanceKm(), [plannedRoute]);
  const shownDistance = distanceEdited ? distanceText : points.length > 1 ? measuredKm.toFixed(1) : '';

  const parkZones = useMemo(() => zones.filter((z) => z.park_id === parkId), [zones, parkId]);
  const zoneOptions = useMemo(() => [NO_ZONE, ...parkZones.map((z) => z.zone_id)], [parkZones]);
  const zoneLabels = useMemo(() => {
    const l: Record<string, string> = { [NO_ZONE]: 'Whole park' };
    parkZones.forEach((z) => (l[z.zone_id] = z.name));
    return l;
  }, [parkZones]);

  const selectedZone = parkZones.find((z) => z.zone_id === zoneId);
  const selectedPark = parks.find((p) => p.park_id === parkId);
  const mapCenter = selectedZone
    ? { latitude: selectedZone.center_lat, longitude: selectedZone.center_lng }
    : selectedPark
      ? { latitude: selectedPark.center_lat, longitude: selectedPark.center_lng }
      : DEFAULT_CENTER;

  const markers = useMemo<MapPoint[]>(
    () =>
      points.map((p, i) => {
        const kind = i === points.length - 1 && i > 0 ? 'destination' : 'planned';
        return {
          // Markers don't redraw their content, so the id changes when a point becomes / stops being the end.
          id: `wp-${i}-${kind}`,
          latitude: p.latitude,
          longitude: p.longitude,
          kind,
          badge: String(i + 1),
          label: `${i + 1}. ${p.note || (i === 0 ? 'Start' : i === points.length - 1 ? 'End' : 'Waypoint')}`,
        };
      }),
    [points],
  );
  const lines = useMemo<MapLine[]>(
    () =>
      points.length > 1
        ? [{ id: 'planned', coordinates: points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })), color: colors.forest700, dashed: true, width: 3 }]
        : [],
    [points],
  );

  const selectedRanger = rangers.data?.find((r) => r.id === rangerId);
  const clearError = (field: AssignmentField) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  const buildInput = (): PatrolAssignmentInput => ({
    rangerId,
    title,
    parkId,
    zoneId,
    scheduledFor,
    instructions,
    plannedDistanceText: shownDistance,
    route: plannedRoute,
  });

  const validate = () =>
    supervisor.validateAssignment(buildInput(), { editing, originalScheduledFor: patrol?.scheduledFor ?? null });

  const next = () => {
    const all = validate();
    const stepErrors = Object.fromEntries(
      Object.entries(all).filter(([k]) => STEP_OF[k as AssignmentField] === step),
    ) as AssignmentErrors;
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep((s) => Math.min(3, s + 1));
  };

  const submit = async () => {
    setSubmitError(null);
    const all = validate();
    if (Object.keys(all).length) {
      setErrors(all);
      setStep(Math.min(...Object.keys(all).map((k) => STEP_OF[k as AssignmentField])));
      return;
    }
    setSubmitting(true);
    try {
      const input = buildInput();
      const id = patrol ? await supervisor.updatePatrolRoute(patrol, input) : await supervisor.assignPatrol(input);
      const distance = parseDistance(shownDistance);
      done.current = true;
      toast.show(patrol ? 'Patrol route updated' : 'Patrol assigned', 'ok');
      navigation.replace('PatrolSaved', {
        patrolId: id,
        mode: patrol ? 'updated' : 'assigned',
        title: title.trim(),
        rangerName: selectedRanger?.full_name ?? patrol?.getRangerName() ?? 'Ranger',
        scheduledFor: scheduledFor ? scheduledFor.toISOString() : null,
        waypointCount: points.length,
        plannedDistanceKm: distance === null || Number.isNaN(distance) ? Math.round(measuredKm * 100) / 100 : distance,
      });
    } catch (e) {
      if (e instanceof AssignmentValidationError) {
        setErrors(e.errors);
        setStep(Math.min(...Object.keys(e.errors).map((k) => STEP_OF[k as AssignmentField])));
      } else {
        const msg = getErrorMessage(e);
        setSubmitError(msg);
        toast.show(msg, 'critical');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onBack = () => (step > 1 ? setStep(step - 1) : navigation.goBack());

  const filteredRangers = (rangers.data ?? []).filter((r) => {
    const q = query.trim().toLowerCase();
    return !q || r.full_name.toLowerCase().includes(q) || (r.employee_id ?? '').toLowerCase().includes(q);
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader
        step={step}
        total={3}
        title={editing ? `Edit route · ${patrol?.getCode()}` : 'Assign patrol'}
        context={STEPS[step - 1]}
        onBack={onBack}
      />
      <OfflineBanner />
      <Screen>
        {editing && step === 1 ? (
          <Notice
            tone="info"
            icon={InfoIcon}
            title="Updating before the patrol starts"
            message="When you save, the ranger is notified and sees this patrol marked “Route updated” with the new route."
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {step === 1 ? (
          <>
            <Input
              icon={SearchIcon}
              placeholder="Search name or employee ID"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
            {errors.ranger ? (
              <AppText size={12} color={colors.crit} style={{ marginTop: 8 }}>
                {errors.ranger}
              </AppText>
            ) : null}
            <View style={{ marginTop: 16 }}>
              <RemoteStatus remote={rangers} loadingLabel="Loading rangers…">
                {() =>
                  filteredRangers.length ? (
                    <View style={{ gap: 10 }}>
                      {filteredRangers.map((r) => (
                        <PersonCard
                          key={r.id}
                          name={r.full_name || 'Unnamed ranger'}
                          subtitle={`${r.employee_id ?? 'No employee ID'} · ${r.park_id ? parkName(r.park_id) : 'No park set'}`}
                          detail={`${r.assignedCount} assigned · ${r.completedCount} completed`}
                          status={r.onPatrol ? 'On Patrol' : 'Available'}
                          selectable
                          selected={rangerId === r.id}
                          onPress={() => {
                            setRangerId(r.id);
                            clearError('ranger');
                          }}
                        />
                      ))}
                    </View>
                  ) : (
                    <EmptyState
                      icon={UsersIcon}
                      title={query ? 'No matching rangers' : 'No rangers found'}
                      message={
                        query
                          ? 'Try a different name or employee ID.'
                          : 'Rangers appear here after they register with the Ranger role for this park.'
                      }
                    />
                  )
                }
              </RemoteStatus>
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: 16 }}>
            <Field label="Patrol / route name" required error={errors.title}>
              <Input
                value={title}
                onChangeText={(t) => {
                  setTitle(t);
                  clearError('title');
                }}
                placeholder="e.g. Block II fence line sweep"
                invalid={!!errors.title}
                maxLength={120}
              />
            </Field>

            {editing ? (
              <Field label="Park">
                <AppText size={14} weight="medium">
                  {parkName(parkId)}
                </AppText>
              </Field>
            ) : (
              <Field label="Park" required error={errors.park}>
                {parks.length ? (
                  <FilterChips
                    options={parks.map((p) => p.park_id)}
                    value={parkId ?? ''}
                    labels={Object.fromEntries(parks.map((p) => [p.park_id, p.name]))}
                    onChange={(id) => {
                      setParkId(id);
                      setZoneId(null);
                      clearError('park');
                    }}
                  />
                ) : (
                  <AppText size={13} color={colors.muted}>
                    Park list not loaded yet. Connect to the network and reopen this form.
                  </AppText>
                )}
              </Field>
            )}

            <Field label="Zone" hint="Choose the patrol zone, or keep the whole park.">
              <FilterChips
                options={zoneOptions}
                value={zoneId ?? NO_ZONE}
                labels={zoneLabels}
                onChange={(id) => setZoneId(id === NO_ZONE ? null : id)}
              />
            </Field>

            <View>
              <SectionHeader title={`Planned waypoints (${points.length})`} style={{ marginBottom: 6 }} />
              <AppText size={12} color={errors.waypoints ? colors.crit : colors.muted} style={{ marginBottom: 8 }}>
                {errors.waypoints ?? 'Tap the map to add waypoints in patrol order. The dashed line shows the route.'}
              </AppText>
              <MapPanel
                key={`${parkId ?? ''}:${zoneId ?? ''}`}
                markers={markers}
                lines={lines}
                center={mapCenter}
                height={280}
                autoFit={false}
                onPress={(c) => {
                  setPoints((p) => [...p, { latitude: c.latitude, longitude: c.longitude, note: '' }]);
                  clearError('waypoints');
                }}
                style={errors.waypoints ? { borderColor: colors.crit } : undefined}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Undo2Icon}
                  disabled={!points.length}
                  onPress={() => setPoints((p) => p.slice(0, -1))}
                >
                  Undo last
                </Button>
                <Button variant="outline" size="sm" icon={EraserIcon} disabled={!points.length} onPress={() => setPoints([])}>
                  Clear
                </Button>
              </View>
              {points.length ? (
                <Card style={{ marginTop: 12, padding: 12, gap: 10 }}>
                  {points.map((p, i) => (
                    <View key={`${i}-${p.latitude}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: i === points.length - 1 && i > 0 ? colors.forest700 : colors.forest500,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AppText size={11} weight="bold" color={colors.white} lineHeight={13}>
                          {i + 1}
                        </AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          value={p.note}
                          placeholder={i === 0 ? 'Start point name (optional)' : 'Waypoint name (optional)'}
                          onChangeText={(t) => setPoints((all) => all.map((x, j) => (j === i ? { ...x, note: t } : x)))}
                          maxLength={80}
                          style={{ paddingVertical: 8, fontSize: 13 }}
                        />
                        <AppText size={11} color={colors.muted} style={{ marginTop: 2 }}>
                          {formatCoord(p.latitude, p.longitude)}
                        </AppText>
                      </View>
                    </View>
                  ))}
                </Card>
              ) : null}
            </View>

            <Field
              label="Planned distance (km)"
              error={errors.distance}
              hint={
                points.length > 1
                  ? distanceEdited
                    ? `Measured along the waypoints: ${formatKm(measuredKm)}`
                    : 'Calculated from the waypoints. You can adjust it.'
                  : 'Calculated automatically once you add waypoints.'
              }
            >
              <Input
                value={shownDistance}
                keyboardType="decimal-pad"
                placeholder="0.0"
                invalid={!!errors.distance}
                onChangeText={(t) => {
                  setDistanceText(t);
                  setDistanceEdited(true);
                  clearError('distance');
                }}
                right={
                  distanceEdited && points.length > 1 ? (
                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        setDistanceEdited(false);
                        clearError('distance');
                      }}
                    >
                      <AppText size={12} weight="semibold" color={colors.forest500}>
                        Use measured
                      </AppText>
                    </Pressable>
                  ) : undefined
                }
              />
            </Field>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: 16 }}>
            <Field label="Scheduled start" required error={errors.scheduledFor}>
              <DateTimeField
                value={scheduledFor}
                invalid={!!errors.scheduledFor}
                minimumDate={new Date()}
                onChange={(d) => {
                  setScheduledFor(d);
                  clearError('scheduledFor');
                }}
              />
            </Field>
            <Field label="Instructions for the ranger" hint="Shown with the route on the ranger’s patrol screen.">
              <Input
                value={instructions}
                onChangeText={setInstructions}
                multiline
                placeholder="What to check along the route, hazards, pickup point…"
                maxLength={1000}
              />
            </Field>

            <View>
              <SectionHeader title="Summary" />
              <Card style={{ padding: 16 }}>
                <KeyValue
                  items={[
                    { label: 'Ranger', value: selectedRanger?.full_name ?? patrol?.getRangerName() ?? '—' },
                    { label: 'Route', value: title.trim() || '—' },
                    { label: 'Park', value: parkName(parkId) },
                    { label: 'Zone', value: zoneName(zoneId) ?? 'Whole park' },
                    { label: 'Waypoints', value: String(points.length) },
                    { label: 'Planned distance', value: shownDistance ? `${shownDistance} km` : '—' },
                    { label: 'Scheduled', value: scheduledFor ? formatDateTime(scheduledFor) : '—' },
                  ]}
                />
              </Card>
            </View>

            {editing ? (
              <Notice
                tone="info"
                icon={MapPinIcon}
                message="The ranger will see “Route updated” on this patrol and receive a notification to review it before starting."
              />
            ) : null}
            {submitError ? (
              <Notice
                tone="critical"
                icon={TriangleAlertIcon}
                title={editing ? 'Route not updated' : 'Patrol not assigned'}
                message={`${submitError} Your entries are kept – you can try again.`}
              />
            ) : null}
            {!online ? (
              <Notice
                tone="warn"
                icon={CloudOffIcon}
                title="No connection"
                message="Assigning and updating patrols needs a connection to the operations server. Your entries stay on this screen."
              />
            ) : null}
          </View>
        ) : null}
      </Screen>
      <StickyFooter>
        {step < 3 ? (
          <Button full size="lg" onPress={next}>
            Continue
          </Button>
        ) : (
          <Button full size="lg" loading={submitting} disabled={!online} onPress={submit}>
            {editing ? 'Save route changes' : 'Assign patrol'}
          </Button>
        )}
      </StickyFooter>
    </View>
  );
}
