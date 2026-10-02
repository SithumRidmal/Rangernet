import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2Icon,
  ClipboardListIcon,
  ClockIcon,
  CloudOffIcon,
  FootprintsIcon,
  PlayIcon,
  RouteIcon,
  ShieldAlertIcon,
  SirenIcon,
  TriangleAlertIcon,
} from 'lucide-react-native';
import {
  ActionTile,
  AppText,
  Avatar,
  BellButton,
  Button,
  Card,
  Screen,
  SectionHeader,
  StatusBadge,
} from '@shared/components';
import { colors, radius } from '@shared/theme';
import { useProfile } from '@shared/auth/AuthProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { useLookups } from '@shared/lookups/useLookups';
import { firstName, formatCode, formatDateTime, formatKm, relativeTime } from '@shared/utils/format';
import { usePatrolTracker } from '@features/uc02-patrol-tracking/ranger/services/PatrolTracker';
import { useMyPatrols } from '@features/uc02-patrol-tracking/ranger/services/usePatrols';
import { useMyIncidents } from '@features/uc01-incident-reporting/services/useMyIncidents';
import { useMyResponses } from '@features/uc04-human-wildlife-conflict/ranger-response/services/useResponses';
import { useNow } from '@navigation/ranger/useNow';
import { useRangerNavigation } from '../../navigation/types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function RangerHomeScreen() {
  const navigation = useRangerNavigation();
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const { online, pending, failed, lastSyncTime } = useSync();
  const { zoneName, parkName } = useLookups();
  const tracker = usePatrolTracker();
  const patrols = useMyPatrols();
  const incidents = useMyIncidents();
  const responses = useMyResponses();
  const now = useNow(60_000);

  const nextPatrol = patrols.items.find((p) => p.displayStatus === 'Assigned');
  const activeResponses = responses.items.filter((r) => r.assignment.isActive);
  const newResponses = activeResponses.filter((r) => r.assignment.responseStatus === 'Assigned');
  const today = new Date(now).toDateString();
  const incidentsToday = incidents.items.filter((i) => new Date(i.reportedAt).toDateString() === today).length;
  const weekAgo = now - 7 * 86400000;
  const completedWeek = patrols.items.filter(
    (p) => p.displayStatus === 'Completed' && p.patrol.endTime && Date.parse(p.patrol.endTime) > weekAgo,
  ).length;
  const refreshing = patrols.loading || incidents.loading || responses.loading;
  const refresh = () => {
    void patrols.reload();
    void incidents.reload();
    void responses.reload();
  };

  const onPatrolTile = () => {
    if (tracker.session) navigation.navigate('ActivePatrol');
    else if (nextPatrol) navigation.navigate('PatrolDetail', { patrolId: nextPatrol.patrol.patrolId });
    else navigation.navigate('Tabs', { screen: 'Patrols' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <View style={{ backgroundColor: colors.forest700, paddingTop: insets.top + 12, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}>
          <Avatar name={profile.full_name} size={44} />
          <View style={{ flex: 1 }}>
            <AppText size={17} weight="semibold" color={colors.white}>
              {greeting()}, {firstName(profile.full_name) || 'Ranger'}
            </AppText>
            <AppText size={12} color={colors.forest200} numberOfLines={1}>
              {[profile.employee_id, profile.assigned_area ?? parkName(profile.park_id)].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          <BellButton tone="onDark" />
        </View>
        <Pressable
          onPress={() => navigation.navigate('SyncCenter')}
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderRadius: radius.md,
            backgroundColor: 'rgba(8,48,31,0.55)',
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: online && failed === 0 ? 'rgba(46,158,107,0.25)' : 'rgba(232,162,58,0.25)',
            }}
          >
            {!online ? (
              <CloudOffIcon size={18} color={colors.warn} />
            ) : failed > 0 ? (
              <TriangleAlertIcon size={18} color={colors.warn} />
            ) : (
              <CheckCircle2Icon size={18} color={colors.forest100} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <AppText size={14} weight="semibold" color={colors.white}>
              {!online ? 'Working offline' : failed > 0 ? `${failed} record${failed === 1 ? '' : 's'} failed to sync` : pending > 0 ? 'Syncing records…' : 'All data synced'}
            </AppText>
            <AppText size={12} color={colors.forest200}>
              {lastSyncTime ? `Last sync ${relativeTime(lastSyncTime)}` : 'Records upload automatically'} · {pending} pending
            </AppText>
          </View>
          <AppText size={12} weight="semibold" color={colors.forest200}>
            Sync Center
          </AppText>
        </Pressable>
      </View>

      <Screen onRefresh={refresh} refreshing={refreshing && patrols.items.length > 0}>
        {tracker.session && tracker.patrol ? (
          <Card style={{ marginBottom: 16, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <AppText size={13} weight="semibold" color={colors.forest700}>
                Current patrol
              </AppText>
              <StatusBadge status="In Progress" size="sm" />
            </View>
            <View style={{ padding: 16 }}>
              <AppText size={17} weight="semibold">
                {tracker.patrol.code} · {tracker.patrol.title}
              </AppText>
              <AppText size={13} color={colors.muted} style={{ marginTop: 2 }}>
                Started {formatDateTime(tracker.session.startTime)} · {formatKm(tracker.distanceKm, 2)} recorded
              </AppText>
              <Button full icon={PlayIcon} style={{ marginTop: 12 }} onPress={() => navigation.navigate('ActivePatrol')}>
                Continue Patrol
              </Button>
            </View>
          </Card>
        ) : null}

        {newResponses.length > 0 ? (
          <Pressable
            onPress={() => navigation.navigate('ResponseDetail', { assignmentId: newResponses[0].assignment.assignmentId })}
            style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(216,74,74,0.3)', backgroundColor: colors.white, padding: 14 }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.critBg, alignItems: 'center', justifyContent: 'center' }}>
              <SirenIcon size={19} color={colors.crit} />
            </View>
            <View style={{ flex: 1 }}>
              <StatusBadge status="High Risk" size="sm" />
              <AppText size={14} weight="medium" style={{ marginTop: 4 }}>
                {newResponses.length === 1 ? 'New field response assigned - acknowledge now' : `${newResponses.length} new field responses to acknowledge`}
              </AppText>
            </View>
          </Pressable>
        ) : null}

        <SectionHeader title="Quick actions" />
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ActionTile
              icon={FootprintsIcon}
              tone="solid"
              label={tracker.session ? 'Continue Patrol' : 'Start Patrol'}
              sub={tracker.patrol ? `${tracker.patrol.code} in progress` : nextPatrol ? `${nextPatrol.patrol.code} assigned` : 'No patrol assigned'}
              onPress={onPatrolTile}
            />
            <ActionTile icon={ShieldAlertIcon} tone="critical" label="Report Incident" sub="Snare, carcass, campsite" onPress={() => navigation.navigate('IncidentType')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ActionTile
              icon={SirenIcon}
              tone="warn"
              label="Field Responses"
              sub={`${activeResponses.length} active`}
              onPress={() => navigation.navigate('Tabs', { screen: 'Responses' })}
            />
            <ActionTile
              icon={ClipboardListIcon}
              label="My Incidents"
              sub={`${incidents.items.filter((i) => i.sync !== 'Synced').length} pending sync`}
              onPress={() => navigation.navigate('Tabs', { screen: 'Incidents' })}
            />
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <SectionHeader title="At a glance" />
          <Card style={{ padding: 16, flexDirection: 'row' }}>
            {[
              { label: 'Incidents today', value: incidentsToday, icon: ShieldAlertIcon },
              { label: 'Patrols (7 days)', value: completedWeek, icon: RouteIcon },
              { label: 'Responses', value: activeResponses.length, icon: SirenIcon },
              { label: 'Pending sync', value: pending, icon: CloudOffIcon },
            ].map((s) => (
              <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
                <s.icon size={16} color={colors.forest500} />
                <AppText size={18} weight="semibold" style={{ marginTop: 6 }}>
                  {s.value}
                </AppText>
                <AppText size={10} color={colors.muted} align="center">
                  {s.label}
                </AppText>
              </View>
            ))}
          </Card>
        </View>

        <View style={{ marginTop: 20 }}>
          <SectionHeader title="Assigned next" action="All patrols" onAction={() => navigation.navigate('Tabs', { screen: 'Patrols' })} />
          {nextPatrol ? (
            <Card onPress={() => navigation.navigate('PatrolDetail', { patrolId: nextPatrol.patrol.patrolId })} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' }}>
                  <ClockIcon size={18} color={colors.forest500} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText size={14} weight="semibold" numberOfLines={1}>
                    {nextPatrol.patrol.code} · {nextPatrol.patrol.title}
                  </AppText>
                  <AppText size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 2 }}>
                    {formatDateTime(nextPatrol.patrol.scheduledFor)} · {zoneName(nextPatrol.patrol.zoneId) ?? parkName(nextPatrol.patrol.parkId)}
                  </AppText>
                </View>
                <StatusBadge status={nextPatrol.patrol.routeUpdatedAt ? 'Route updated' : 'Assigned'} size="sm" dot={false} />
              </View>
            </Card>
          ) : (
            <Card style={{ padding: 14 }}>
              <AppText size={13} color={colors.muted}>
                {patrols.loading ? 'Loading assigned routes…' : patrols.error ? patrols.error : 'No patrols assigned.'}
              </AppText>
            </Card>
          )}
        </View>

        {incidents.items.length > 0 ? (
          <View style={{ marginTop: 20, marginBottom: 8 }}>
            <SectionHeader title="Recent incidents" action="View all" onAction={() => navigation.navigate('Tabs', { screen: 'Incidents' })} />
            <Card>
              {incidents.items.slice(0, 3).map((i, idx) => (
                <Pressable
                  key={i.key}
                  onPress={() => navigation.navigate('IncidentDetail', { incidentId: i.incidentId })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: idx ? 1 : 0, borderTopColor: colors.line }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.sync === 'Synced' ? colors.forest400 : colors.warn }} />
                  <View style={{ flex: 1 }}>
                    <AppText size={14} weight="medium" numberOfLines={1}>
                      {i.sync === 'Synced' ? i.code : formatCode('INC', null)} · {i.typeName}
                    </AppText>
                    <AppText size={12} color={colors.muted} numberOfLines={1}>
                      {i.description}
                    </AppText>
                  </View>
                  <AppText size={11} color={colors.muted}>
                    {relativeTime(i.reportedAt)}
                  </AppText>
                </Pressable>
              ))}
            </Card>
          </View>
        ) : null}
      </Screen>
    </View>
  );
}
