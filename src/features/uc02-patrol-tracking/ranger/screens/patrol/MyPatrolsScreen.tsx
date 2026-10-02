import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CloudOffIcon, PlayIcon, RouteIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  AppText,
  BellButton,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Notice,
  OfflineBanner,
  PatrolCard,
  Screen,
  StatusBadge,
  Tabs,
} from '@shared/components';
import { colors } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { formatDateTime, formatKm } from '@shared/utils/format';
import { useMyPatrols, type PatrolListItem } from '../../services/usePatrols';
import { usePatrolTracker } from '../../services/PatrolTracker';
import { useRangerNavigation } from '@navigation/ranger/navigation/types';

const TABS = ['Assigned', 'History'] as const;
type Tab = (typeof TABS)[number];

export function patrolZoneLabel(item: PatrolListItem, zoneName: (id: string | null) => string | null, parkName: (id: string | null) => string) {
  return zoneName(item.patrol.zoneId) ?? parkName(item.patrol.parkId);
}

/** UC-02 step 2: the system shows the assigned routes (2b: "No patrols assigned"). */
export function MyPatrolsScreen() {
  const navigation = useRangerNavigation();
  const { items, loading, error, fromCache, reload } = useMyPatrols();
  const tracker = usePatrolTracker();
  const { zoneName, parkName } = useLookups();
  const [tab, setTab] = useState<Tab>('Assigned');

  const list = useMemo(
    () =>
      items.filter((i) =>
        tab === 'Assigned' ? i.displayStatus === 'Assigned' || i.displayStatus === 'In Progress' : i.displayStatus === 'Completed' || i.displayStatus === 'Incomplete',
      ),
    [items, tab],
  );
  const ordered = tab === 'History' ? [...list].reverse() : list;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="My Patrols" subtitle="Assigned patrol routes" right={<BellButton />} hideBack />
      <OfflineBanner />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </View>
      <Screen onRefresh={reload} refreshing={loading && items.length > 0}>
        {tracker.session && tracker.patrol ? (
          <Card style={{ padding: 14, marginBottom: 14, borderColor: colors.forest300 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText size={13} weight="semibold" color={colors.forest700}>
                Current patrol
              </AppText>
              <StatusBadge status="In Progress" size="sm" />
            </View>
            <AppText size={16} weight="semibold" style={{ marginTop: 6 }}>
              {tracker.patrol.code} · {tracker.patrol.title}
            </AppText>
            <AppText size={12} color={colors.muted} style={{ marginTop: 2 }}>
              Started {formatDateTime(tracker.session.startTime)} · {formatKm(tracker.distanceKm, 2)} recorded
            </AppText>
            <Button full icon={PlayIcon} style={{ marginTop: 12 }} onPress={() => navigation.navigate('ActivePatrol')}>
              Continue Patrol
            </Button>
          </Card>
        ) : null}

        {fromCache ? (
          <Notice tone="warn" icon={CloudOffIcon} message="Offline copy of your patrols. Routes stay available without a connection." style={{ marginBottom: 12 }} />
        ) : null}

        {error && items.length === 0 ? (
          <EmptyState icon={TriangleAlertIcon} tone="critical" title="Could not load patrols" message={error} actionLabel="Retry" onAction={reload} />
        ) : loading && items.length === 0 ? (
          <LoadingBlock label="Loading assigned routes…" />
        ) : ordered.length === 0 ? (
          <EmptyState
            icon={RouteIcon}
            title={tab === 'Assigned' ? 'No patrols assigned' : 'No completed patrols yet'}
            message={
              tab === 'Assigned'
                ? 'Your supervisor has not assigned a patrol route to you. You will be notified when one is assigned.'
                : 'Completed and incomplete patrols will appear here.'
            }
            actionLabel="Refresh"
            onAction={reload}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {ordered.map((i) => (
              <PatrolCard
                key={i.patrol.patrolId}
                code={i.patrol.code}
                title={i.patrol.title}
                status={i.displayStatus}
                zone={patrolZoneLabel(i, zoneName, parkName)}
                date={formatDateTime(i.patrol.startTime ?? i.patrol.scheduledFor)}
                distance={
                  i.displayStatus === 'Completed' || i.displayStatus === 'Incomplete'
                    ? `${formatKm(i.patrol.route.distanceCovered)} covered`
                    : i.patrol.route.plannedDistanceKm
                      ? `${formatKm(i.patrol.route.plannedDistanceKm)} planned`
                      : `${i.patrol.route.plannedWaypoints().length} waypoints`
                }
                instructions={i.patrol.instructions}
                extra={
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {i.sync.pending ? <StatusBadge status={i.sync.failed ? 'Failed' : 'Pending Sync'} size="sm" /> : null}
                    {i.patrol.routeUpdatedAt && i.displayStatus === 'Assigned' ? <StatusBadge status="Route updated" size="sm" /> : null}
                  </View>
                }
                onPress={() => navigation.navigate('PatrolDetail', { patrolId: i.patrol.patrolId })}
              />
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}
