import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRightIcon, RouteIcon, UserIcon } from 'lucide-react-native';
import { AppText, PatrolCard, StatusBadge } from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { colors } from '@shared/theme';
import { formatDateTime, formatKm, relativeTime } from '@shared/utils/format';
import type { Patrol } from '../models';

export function patrolDistanceLabel(patrol: Patrol): string {
  const route = patrol.getRoute();
  const planned = route.plannedDistanceKm;
  if (patrol.status === 'Assigned') return planned !== null ? `${formatKm(planned)} planned` : 'Distance not set';
  return planned !== null ? `${formatKm(route.distanceCovered)} of ${formatKm(planned)}` : formatKm(route.distanceCovered);
}

function timeLabel(patrol: Patrol): string {
  const t = patrol.getDisplayTime();
  if (patrol.status === 'Assigned') return `Scheduled ${formatDateTime(t)}`;
  if (patrol.status === 'In Progress') return `Started ${formatDateTime(t)}`;
  return `Ended ${formatDateTime(t)}`;
}

export function SupervisorPatrolCard({ patrol, onPress }: { patrol: Patrol; onPress: () => void }) {
  const { zoneName, parkName } = useLookups();
  const coverage = patrol.getRoute().coveragePercent;
  return (
    <PatrolCard
      code={patrol.getCode()}
      title={patrol.title}
      status={patrol.status}
      zone={zoneName(patrol.zoneId) ?? parkName(patrol.parkId)}
      date={timeLabel(patrol)}
      distance={patrolDistanceLabel(patrol)}
      instructions={patrol.status === 'Incomplete' ? patrol.incompleteReason : patrol.instructions}
      onPress={onPress}
      extra={
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <UserIcon size={12} color={colors.muted} />
            <AppText size={12} color={colors.muted} numberOfLines={1}>
              {patrol.getRangerName()}
            </AppText>
          </View>
          {patrol.isFinished() && coverage !== null ? (
            <AppText size={12} color={colors.muted}>
              {Math.round(coverage)}% coverage
            </AppText>
          ) : null}
          {patrol.isFinished() ? (
            patrol.isReviewed() ? (
              <StatusBadge status="Reviewed" size="sm" />
            ) : (
              <AppText size={12} weight="semibold" color={colors.warnText}>
                Awaiting review
              </AppText>
            )
          ) : null}
          {patrol.status === 'Assigned' && patrol.routeUpdatedAt ? (
            <AppText size={12} weight="semibold" color={colors.info}>
              Route updated
            </AppText>
          ) : null}
        </>
      }
    />
  );
}

/** Compact row used in dashboard lists (design: "Today's patrols"). */
export function PatrolListRow({ patrol, onPress, first }: { patrol: Patrol; onPress: () => void; first?: boolean }) {
  const { zoneName } = useLookups();
  const zone = zoneName(patrol.zoneId);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.line,
        backgroundColor: pressed ? colors.forest50 : 'transparent',
      })}
    >
      <RouteIcon size={17} color={colors.forest500} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText size={14} weight="medium" numberOfLines={1}>
          {patrol.getCode()} · {zone ?? patrol.title}
        </AppText>
        <AppText size={12} color={colors.muted} numberOfLines={1}>
          {patrol.getRangerName()} · {relativeTime(patrol.getDisplayTime())}
        </AppText>
      </View>
      <StatusBadge status={patrol.status} size="sm" />
      <ChevronRightIcon size={16} color={colors.muted} />
    </Pressable>
  );
}
