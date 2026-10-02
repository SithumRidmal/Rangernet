import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  CrosshairIcon,
  FlagIcon,
  MapPinIcon,
  RouteIcon,
  SatelliteDishIcon,
  ShieldAlertIcon,
  SquareIcon,
  TimerIcon,
  TriangleAlertIcon,
} from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BottomSheet,
  Button,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  LocationPicker,
  MapLegend,
  MapPanel,
  Notice,
  OfflineBanner,
  useToast,
  type MapLine,
  type MapPoint,
} from '@shared/components';
import { colors, radius, shadows } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { GpsUnavailableError, type GeoPoint } from '@shared/location/LocationService';
import { getErrorMessage } from '@shared/utils/errors';
import { formatClock, formatCoord, formatKm } from '@shared/utils/format';
import { patrolTracker, usePatrolTracker } from '../../services/PatrolTracker';
import { useNow } from '@navigation/ranger/useNow';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

type MarkStep = { phase: 'locating' } | { phase: 'ready'; point: GeoPoint; manual: boolean } | { phase: 'gps-failed'; message: string };

function useClock(start: string | null) {
  const now = useNow(1000);
  return start ? now - Date.parse(start) : 0;
}

/** UC-02 steps 5-7: continuous GPS tracking, manual waypoints, GPS unavailable handling, complete / stop early. */
export function ActivePatrolScreen({ navigation }: RangerScreenProps<'ActivePatrol'>) {
  const t = usePatrolTracker();
  const toast = useToast();
  const { zoneName, parkName } = useLookups();
  const elapsed = useClock(t.session?.startTime ?? null);
  const [markOpen, setMarkOpen] = useState(false);
  const [mark, setMark] = useState<MarkStep>({ phase: 'locating' });
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const patrol = t.patrol;
  const planned = useMemo(() => patrol?.route.plannedWaypoints() ?? [], [patrol]);
  const marked = t.points.filter((p) => p.waypointType === 'MARKED');

  const lines: MapLine[] = useMemo(() => {
    const l: MapLine[] = [];
    if (planned.length > 1) l.push({ id: 'planned', coordinates: planned.map((w) => ({ latitude: w.latitude, longitude: w.longitude })), color: colors.forest700, dashed: true, width: 3 });
    if (t.points.length > 1) l.push({ id: 'track', coordinates: t.points.map((w) => ({ latitude: w.latitude, longitude: w.longitude })), color: colors.forest400, width: 5 });
    return l;
  }, [planned, t.points]);

  const markers: MapPoint[] = [
    ...planned.map((w, i) => ({ id: `p-${w.waypointId}`, latitude: w.latitude, longitude: w.longitude, kind: 'planned' as const, label: w.note ?? `Waypoint ${i + 1}` })),
    ...marked.map((w) => ({ id: `m-${w.waypointId}`, latitude: w.latitude, longitude: w.longitude, kind: 'waypoint' as const, label: w.note ?? 'Marked waypoint' })),
    ...(t.lastFix ? [{ id: 'me', latitude: t.lastFix.latitude, longitude: t.lastFix.longitude, kind: 'ranger' as const, label: 'You' }] : []),
  ];

  if (!t.session || !patrol) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Patrol" />
        {t.error ? (
          <EmptyState icon={TriangleAlertIcon} tone="critical" title="Patrol session error" message={t.error} />
        ) : (
          <EmptyState icon={RouteIcon} title="No active patrol" message="Start a patrol from My Patrols to begin GPS tracking." actionLabel="Go back" onAction={() => navigation.goBack()} />
        )}
      </View>
    );
  }

  const openMark = async () => {
    setNote('');
    setMark({ phase: 'locating' });
    setMarkOpen(true);
    try {
      const point = await patrolTracker.currentPosition();
      setMark({ phase: 'ready', point, manual: false });
    } catch (e) {
      setMark({ phase: 'gps-failed', message: e instanceof GpsUnavailableError ? e.message : getErrorMessage(e) });
    }
  };

  const saveMark = async () => {
    if (mark.phase !== 'ready') return;
    setSaving(true);
    try {
      await patrolTracker.markWaypoint({ latitude: mark.point.latitude, longitude: mark.point.longitude, manuallyMarked: mark.manual, note });
      setMarkOpen(false);
      toast.show('Waypoint recorded', 'ok');
    } catch (e) {
      toast.show(getErrorMessage(e), 'critical');
    } finally {
      setSaving(false);
    }
  };

  const gpsOff = t.gps === 'unavailable' || t.gps === 'lost';
  const zone = zoneName(patrol.zoneId) ?? parkName(patrol.parkId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar tone={gpsOff ? 'critical' : 'dark'} title={gpsOff ? 'GPS unavailable' : 'Patrol in progress'} subtitle={`${patrol.code} · ${zone}`} />
      <OfflineBanner />
      <View style={{ flex: 1 }}>
        <MapPanel height="100%" rounded={false} markers={markers} lines={lines} follow={t.lastFix ? { latitude: t.lastFix.latitude, longitude: t.lastFix.longitude } : null}>
          {gpsOff || t.gps === 'acquiring' ? (
            <View style={{ position: 'absolute', top: 12, left: 12, right: 12, borderRadius: radius.md, backgroundColor: colors.white, padding: 14, ...shadows.lift }}>
              {t.gps === 'acquiring' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <SatelliteDishIcon size={18} color={colors.forest500} />
                  <AppText size={13} weight="medium" style={{ flex: 1 }}>
                    Activating location tracking…
                  </AppText>
                </View>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TriangleAlertIcon size={17} color={colors.crit} />
                    <AppText size={14} weight="semibold">
                      {t.gps === 'lost' ? 'GPS signal lost' : 'Location service unavailable'}
                    </AppText>
                  </View>
                  <AppText size={12} color={colors.muted} style={{ marginTop: 4 }} lineHeight={17}>
                    {t.gpsMessage ?? ''} Reconnecting automatically. Meanwhile record manual waypoints so your route is not lost.
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Button size="sm" variant="outline" icon={CrosshairIcon} style={{ flex: 1 }} onPress={() => void patrolTracker.reconnect()}>
                      Attempt reconnect
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={MapPinIcon}
                      style={{ flex: 1 }}
                      onPress={() => {
                        setNote('');
                        setMark({ phase: 'gps-failed', message: t.gpsMessage ?? 'GPS unavailable' });
                        setPicking(true);
                      }}
                    >
                      Manual waypoint
                    </Button>
                  </View>
                </>
              )}
            </View>
          ) : null}
          <MapLegend
            style={{ position: 'absolute', left: 12, bottom: 12 }}
            items={[
              { color: colors.forest700, label: 'Planned' },
              { color: colors.forest400, label: 'Your track' },
              { color: colors.info, label: 'Marked' },
            ]}
          />
        </MapPanel>
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
        {t.error ? (
          <Notice tone="critical" icon={TriangleAlertIcon} message={t.error} action="Retry saving" onAction={() => void patrolTracker.flush(true)} style={{ marginBottom: 10 }} />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { label: 'Duration', value: formatClock(elapsed), icon: TimerIcon },
            { label: 'Distance', value: formatKm(t.distanceKm, 2), icon: RouteIcon },
            { label: 'Marked', value: String(marked.length), icon: FlagIcon },
            {
              label: 'GPS',
              value: gpsOff ? 'Off' : t.lastFix?.accuracy ? `±${Math.round(t.lastFix.accuracy)} m` : '…',
              icon: SatelliteDishIcon,
            },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, alignItems: 'center', borderRadius: radius.sm, backgroundColor: gpsOff && s.label === 'GPS' ? colors.critBg : colors.forest50, paddingVertical: 8 }}>
              <s.icon size={14} color={gpsOff && s.label === 'GPS' ? colors.crit : colors.forest500} />
              <AppText size={14} weight="semibold" style={{ marginTop: 4 }}>
                {s.value}
              </AppText>
              <AppText size={10} color={colors.muted}>
                {s.label}
              </AppText>
            </View>
          ))}
        </View>
        {t.gpsMessage && !gpsOff ? (
          <AppText size={11} color={colors.warnText} align="center" style={{ marginTop: 6 }}>
            {t.gpsMessage}
          </AppText>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button variant="secondary" icon={FlagIcon} style={{ flex: 1 }} onPress={() => void openMark()}>
            Mark Waypoint
          </Button>
          <Button variant="outline" icon={ShieldAlertIcon} style={{ flex: 1 }} onPress={() => navigation.navigate('IncidentType')}>
            Report Incident
          </Button>
        </View>
        <Button full icon={SquareIcon} style={{ marginTop: 8 }} onPress={() => navigation.navigate('EndPatrol', { mode: 'complete' })}>
          Complete Patrol
        </Button>
        <Pressable onPress={() => navigation.navigate('EndPatrol', { mode: 'early' })} hitSlop={6} style={{ alignItems: 'center', marginTop: 10 }}>
          <AppText size={13} weight="medium" color={colors.muted}>
            Stop patrol early
          </AppText>
        </Pressable>
      </View>

      <BottomSheet open={markOpen} onClose={() => setMarkOpen(false)} title="Mark waypoint">
        {mark.phase === 'locating' ? (
          <LoadingBlock label="Getting your position…" />
        ) : mark.phase === 'gps-failed' ? (
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <Notice tone="warn" icon={TriangleAlertIcon} title="GPS unavailable" message={`${mark.message} Mark the waypoint manually instead.`} />
            <Button
              full
              icon={MapPinIcon}
              onPress={() => {
                setMarkOpen(false);
                setPicking(true);
              }}
            >
              Mark on map
            </Button>
          </View>
        ) : (
          <View style={{ gap: 14, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {mark.manual ? <MapPinIcon size={18} color={colors.warn} /> : <CrosshairIcon size={18} color={colors.forest500} />}
              <View style={{ flex: 1 }}>
                <AppText size={14} weight="medium">
                  {mark.manual ? 'Manually marked position' : 'Current GPS position'}
                </AppText>
                <AppText size={12} color={colors.muted}>
                  {formatCoord(mark.point.latitude, mark.point.longitude)}
                  {mark.point.accuracy ? ` · ±${Math.round(mark.point.accuracy)} m` : ''}
                </AppText>
              </View>
            </View>
            <Field label="Information" hint="What is at this waypoint? (optional)">
              <Input value={note} onChangeText={setNote} placeholder="e.g. Fence break, water hole, animal signs" maxLength={200} />
            </Field>
            <Button full loading={saving} onPress={() => void saveMark()}>
              Save waypoint
            </Button>
          </View>
        )}
      </BottomSheet>

      <LocationPicker
        visible={picking}
        title="Mark waypoint manually"
        initial={t.lastFix ? { latitude: t.lastFix.latitude, longitude: t.lastFix.longitude } : (planned[0] ?? null)}
        onCancel={() => setPicking(false)}
        onConfirm={(p) => {
          setPicking(false);
          if (p.latitude === null || p.longitude === null) return;
          setMark({ phase: 'ready', manual: true, point: { latitude: p.latitude, longitude: p.longitude, accuracy: null, timestamp: Date.now() } });
          setMarkOpen(true);
        }}
      />
    </View>
  );
}
