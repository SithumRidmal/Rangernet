import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle2Icon,
  ClipboardListIcon,
  ClockIcon,
  CloudOffIcon,
  CloudUploadIcon,
  FilePenLineIcon,
  InboxIcon,
  MessageSquareTextIcon,
  PawPrintIcon,
} from 'lucide-react-native';
import {
  ActionTile,
  AppText,
  Avatar,
  BellButton,
  Card,
  EmptyState,
  MetricCard,
  Notice,
  Screen,
  SectionHeader,
  Skeleton,
} from '@shared/components';
import { useProfile } from '@shared/auth/AuthProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { firstName, relativeTime } from '@shared/utils/format';
import { useMyReports } from '../services/useMyReports';
import { isSmsReportingConfigured } from '../services/SmsReportService';
import { useReportDraft } from '../context/ReportDraftProvider';
import { ReportListCard } from '../components/ReportListCard';
import { SafetyCard } from '../components/SafetyCard';
import { useCommunityNavigation, type ReportFilter } from '../navigation/types';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const profile = useProfile();
  const navigation = useCommunityNavigation();
  const insets = useSafeAreaInsets();
  const { online, syncStatus, lastSyncTime } = useSync();
  const { items, counts, loading, refreshing, error, cachedAt, refresh } = useMyReports();
  const draft = useReportDraft();
  const smsEnabled = isSmsReportingConfigured();

  const openList = (filter: ReportFilter) => navigation.navigate('Tabs', { screen: 'MyReports', params: { filter } });
  const recent = items.slice(0, 3);

  const syncTitle = !online ? 'Working offline' : syncStatus === 'Syncing' ? 'Sending saved reports…' : counts.pendingSync ? 'Reports waiting to sync' : 'Connected';
  const syncDetail = counts.pendingSync
    ? `${counts.pendingSync} report${counts.pendingSync === 1 ? '' : 's'} stored on this device${online ? '' : ' · sent when back online'}`
    : lastSyncTime
      ? `All reports sent · last sync ${relativeTime(lastSyncTime)}`
      : 'Reports are sent as soon as you submit';

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <View style={{ backgroundColor: colors.forest700, paddingTop: insets.top + 12, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
          <Avatar name={profile.full_name || 'Member'} size={44} dark />
          <View style={{ flex: 1 }}>
            <AppText size={17} weight="semibold" color={colors.white} numberOfLines={1}>
              {greeting()}
              {firstName(profile.full_name) ? `, ${firstName(profile.full_name)}` : ''}
            </AppText>
            <AppText size={12} color={colors.forest200} numberOfLines={1}>
              {profile.village ? `${profile.village} · ` : ''}Community Member
            </AppText>
          </View>
          <BellButton tone="onDark" />
        </View>
        <Pressable
          onPress={() => navigation.navigate('SyncCenter')}
          style={({ pressed }) => ({
            marginHorizontal: 16,
            marginTop: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderRadius: 12,
            backgroundColor: pressed ? colors.forest900 : colors.forest800,
            paddingHorizontal: 14,
            paddingVertical: 12,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: online ? 'rgba(46,158,107,0.25)' : 'rgba(232,162,58,0.25)',
            }}
          >
            {online ? (
              counts.pendingSync ? <CloudUploadIcon size={18} color={colors.forest100} /> : <CheckCircle2Icon size={18} color={colors.forest100} />
            ) : (
              <CloudOffIcon size={18} color={colors.warn} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <AppText size={13.5} weight="semibold" color={colors.white}>
              {syncTitle}
            </AppText>
            <AppText size={12} color={colors.forest200} numberOfLines={1}>
              {syncDetail}
            </AppText>
          </View>
          <AppText size={12} weight="semibold" color={colors.forest200}>
            Sync Center
          </AppText>
        </Pressable>
      </View>

      <Screen onRefresh={refresh} refreshing={refreshing}>
        {draft.hasProgress ? (
          <Card onPress={() => navigation.navigate('ReportType')} style={{ padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.warnBg, alignItems: 'center', justifyContent: 'center' }}>
              <FilePenLineIcon size={18} color={colors.warn} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText size={14} weight="semibold">
                Unfinished report
              </AppText>
              <AppText size={12} color={colors.muted}>
                {draft.report?.conflictType?.getTypeName() ?? 'Conflict report'} · tap to continue
              </AppText>
            </View>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row' }}>
          <ActionTile
            icon={PawPrintIcon}
            label="Report a conflict"
            sub="Elephants, crop-raiding or animals near homes"
            tone="solid"
            onPress={() => navigation.navigate('ReportType')}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          {smsEnabled ? (
            <ActionTile icon={MessageSquareTextIcon} label="Report by SMS" sub="No internet data needed" onPress={() => navigation.navigate('SmsReport')} />
          ) : null}
          <ActionTile
            icon={ClipboardListIcon}
            label="My reports"
            sub={`${counts.submitted} submitted`}
            onPress={() => navigation.navigate('Tabs', { screen: 'MyReports' })}
          />
        </View>

        <SectionHeader title="My report status" style={{ marginTop: 22 }} />
        {cachedAt ? (
          <Notice tone="info" message={`Showing reports saved on this device ${relativeTime(cachedAt)}. Pull down to refresh.`} style={{ marginBottom: 10 }} />
        ) : error ? (
          <Notice tone="critical" title="Could not load your reports" message={error} action="Try again" onAction={refresh} style={{ marginBottom: 10 }} />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MetricCard label="Submitted" value={loading ? '–' : counts.submitted} icon={ClipboardListIcon} onPress={() => openList('All')} />
          <MetricCard label="In progress" value={loading ? '–' : counts.inProgress} icon={ClockIcon} tone="info" onPress={() => openList('Open')} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <MetricCard label="Resolved" value={loading ? '–' : counts.resolved} icon={CheckCircle2Icon} tone="ok" onPress={() => openList('Resolved')} />
          <MetricCard
            label="Pending sync"
            value={loading ? '–' : counts.pendingSync}
            icon={CloudUploadIcon}
            tone={counts.pendingSync ? 'warn' : 'default'}
            onPress={() => openList('Pending Sync')}
          />
        </View>

        <SectionHeader
          title="Recent reports"
          action={items.length ? 'See all' : undefined}
          onAction={() => openList('All')}
          style={{ marginTop: 22 }}
        />
        {loading ? (
          <View style={{ gap: 10 }}>
            <Skeleton style={{ height: 86, borderRadius: 12 }} />
            <Skeleton style={{ height: 86, borderRadius: 12 }} />
          </View>
        ) : recent.length ? (
          <View style={{ gap: 10 }}>
            {recent.map((item) => (
              <ReportListCard
                key={item.report.reportId}
                item={item}
                onPress={() => navigation.navigate('ReportDetail', { reportId: item.report.reportId })}
              />
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState
              icon={InboxIcon}
              title="No reports yet"
              message="When wildlife threatens your crops, home or family, report it here."
            />
          </Card>
        )}

        <View style={{ marginTop: 22, marginBottom: 8 }}>
          <SafetyCard />
        </View>
      </Screen>
    </View>
  );
}
