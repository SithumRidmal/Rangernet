import React, { useState } from 'react';
import { View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { CheckCircle2Icon, RouteIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  RadioRow,
  Screen,
  StickyFooter,
  Timeline,
} from '@shared/components';
import { colors, radius } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { formatClock, formatCoord, formatKm, formatTime } from '@shared/utils/format';
import { PatrolRoute } from '../../models/PatrolRoute';
import { patrolTracker, usePatrolTracker } from '../../services/PatrolTracker';
import { useNow } from '@navigation/ranger/useNow';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

const END_REASONS = [
  'Weather conditions',
  'Injury',
  'Vehicle failure',
  'Dangerous wildlife',
  'Security threat',
  'Emergency response',
  'Restricted access',
  'Other',
] as const;

/** UC-02 step 7 (Complete Patrol) and exception 14a (stop early -> confirm -> Incomplete). */
export function EndPatrolScreen({ navigation, route }: RangerScreenProps<'EndPatrol'>) {
  const early = route.params.mode === 'early';
  const t = usePatrolTracker();
  const [reason, setReason] = useState<(typeof END_REASONS)[number] | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(1000);

  if (!t.session || !t.patrol) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title={early ? 'Stop patrol early' : 'Complete patrol'} />
        <EmptyState icon={RouteIcon} title="No active patrol" message="There is no patrol in progress on this device." />
      </View>
    );
  }
  const patrol = t.patrol;
  const elapsed = now - Date.parse(t.session.startTime);
  const calc = PatrolRoute.calculate(patrol.route.plannedWaypoints(), t.points, patrol.route.plannedDistanceKm);
  const marked = t.points.filter((p) => p.waypointType === 'MARKED').length;
  const first = t.points[0];
  const last = t.points[t.points.length - 1];
  const needsReason = early && !reason;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const reasonText = early ? [reason, notes.trim()].filter(Boolean).join(' - ') : null;
      const summary = await patrolTracker.finish(!early, reasonText);
      navigation.dispatch(
        CommonActions.reset({ index: 1, routes: [{ name: 'Tabs' }, { name: 'PatrolSummary', params: { summary } }] }),
      );
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title={early ? 'Stop patrol early' : 'Complete patrol'} subtitle={`${patrol.code} · ${patrol.title}`} />
      <Screen>
        {early ? (
          <Card style={{ padding: 14, flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <CheckCircle2Icon size={17} color={colors.ok} style={{ marginTop: 2 }} />
            <AppText size={13} color={colors.muted} lineHeight={19} style={{ flex: 1 }}>
              Everything recorded so far ({formatKm(calc.distanceKm, 2)} of route and {marked} marked waypoint{marked === 1 ? '' : 's'}) is kept. The
              patrol will be recorded as Incomplete and your supervisor will review it.
            </AppText>
          </Card>
        ) : (
          <Card style={{ padding: 16 }}>
            <AppText size={15} weight="semibold">
              Review before completing
            </AppText>
            <AppText size={13} color={colors.muted} style={{ marginTop: 4 }}>
              The completion time is recorded and the final route and coverage are calculated.
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              {[
                { label: 'Duration', value: formatClock(elapsed) },
                {
                  label: 'Distance',
                  value: patrol.route.plannedDistanceKm ? `${formatKm(calc.distanceKm, 1)} of ${formatKm(patrol.route.plannedDistanceKm)}` : formatKm(calc.distanceKm, 2),
                },
                { label: 'Coverage (estimate)', value: calc.coveragePercent === null ? '—' : `${calc.coveragePercent}%` },
                { label: 'Waypoints', value: calc.plannedCount ? `${calc.visitedCount}/${calc.plannedCount} visited · ${marked} marked` : `${marked} marked` },
              ].map((s) => (
                <View key={s.label} style={{ width: '48%', borderRadius: radius.md, backgroundColor: colors.forest50, padding: 12 }}>
                  <AppText size={16} weight="semibold">
                    {s.value}
                  </AppText>
                  <AppText size={12} color={colors.muted} style={{ marginTop: 2 }}>
                    {s.label}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        )}

        {!early && first ? (
          <Card style={{ padding: 16, marginTop: 12 }}>
            <Timeline
              entries={[
                { label: 'Starting point', detail: formatCoord(first.latitude, first.longitude), time: formatTime(first.timestamp), done: true },
                ...(last && last !== first
                  ? [{ label: 'Current location', detail: formatCoord(last.latitude, last.longitude), time: formatTime(last.timestamp), done: true, tone: 'ok' as const }]
                  : []),
              ]}
            />
          </Card>
        ) : null}

        {!early && calc.coveragePercent !== null && calc.coveragePercent < 100 ? (
          <Notice
            tone="warn"
            icon={TriangleAlertIcon}
            message="Part of the planned route has not been covered. If you cannot finish the route, use “Stop patrol early” so your supervisor can review it."
            style={{ marginTop: 12 }}
          />
        ) : null}

        {early ? (
          <>
            <AppText size={13} weight="medium" style={{ marginBottom: 10 }}>
              Why is the patrol ending early?
            </AppText>
            <View style={{ gap: 8 }}>
              {END_REASONS.map((r) => (
                <RadioRow key={r} label={r} selected={reason === r} onSelect={() => setReason(r)} />
              ))}
            </View>
            <Field label="Notes" hint="Details for your supervisor (optional)" style={{ marginTop: 16 }}>
              <Input multiline value={notes} onChangeText={setNotes} maxLength={400} placeholder="What happened?" />
            </Field>
          </>
        ) : null}

        {error ? (
          <Notice tone="critical" icon={TriangleAlertIcon} title="Could not finish the patrol" message={`${error} Your recorded data is preserved - try again.`} style={{ marginTop: 14 }} />
        ) : null}
      </Screen>
      <StickyFooter>
        <Button full size="lg" variant={early ? 'warning' : 'primary'} disabled={needsReason} loading={busy} onPress={() => void confirm()}>
          {early ? 'Confirm - end patrol' : 'Complete Patrol'}
        </Button>
        <Button full variant="ghost" onPress={() => navigation.goBack()}>
          Return to patrol
        </Button>
      </StickyFooter>
    </View>
  );
}
