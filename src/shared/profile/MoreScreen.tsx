import React, { useState } from 'react';
import { View } from 'react-native';
import { BellIcon, CloudIcon, LogOutIcon, UserIcon, type LucideIcon } from 'lucide-react-native';
import { colors } from '../theme';
import { AppText } from '../components/ui/AppText';
import { AppBar, Modal, OfflineBanner, Screen } from '../components/ui/chrome';
import { Button, Card, Divider, ListRow, SectionHeader, StatusBadge } from '../components/ui/primitives';
import { Avatar } from '../components/cards';
import { useAuth } from '../auth/AuthProvider';
import { useSync } from '../sync/SyncProvider';
import { useSharedNavigation } from '../navigation/types';
import { useNotifications } from '../notifications/NotificationsProvider';
import { ROLE_LABELS } from '../types';

export type MoreTool = { icon: LucideIcon; label: string; subtitle?: string; onPress: () => void };

/** "More" tab used by every role; each role passes its own tools. */
export function MoreScreen({ tools = [] }: { tools?: MoreTool[] }) {
  const { profile, signOut } = useAuth();
  const { pending, failed } = useSync();
  const { unread } = useNotifications();
  const navigation = useSharedNavigation();
  const [confirm, setConfirm] = useState(false);
  if (!profile) return null;
  const unsynced = pending + failed;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="More" hideBack />
      <OfflineBanner />
      <Screen>
        <Card onPress={() => navigation.navigate('Profile')} style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={profile.full_name} size={52} />
            <View style={{ flex: 1 }}>
              <AppText size={16} weight="semibold">
                {profile.full_name || 'Unnamed user'}
              </AppText>
              <AppText size={12} color={colors.muted}>
                {ROLE_LABELS[profile.role]}
                {profile.employee_id ? ` · ${profile.employee_id}` : ''}
              </AppText>
              <AppText size={12} color={colors.muted} numberOfLines={1}>
                {profile.email}
              </AppText>
            </View>
          </View>
        </Card>

        {tools.length ? (
          <>
            <SectionHeader title="Tools" style={{ marginTop: 20 }} />
            <Card>
              {tools.map((t, i) => (
                <View key={t.label}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow icon={t.icon} title={t.label} subtitle={t.subtitle} onPress={t.onPress} />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <SectionHeader title="Account" style={{ marginTop: 20 }} />
        <Card>
          <ListRow
            icon={CloudIcon}
            title="Sync Center"
            subtitle="Offline records and synchronization"
            onPress={() => navigation.navigate('SyncCenter')}
            right={unsynced ? <StatusBadge status="Pending Sync" size="sm" /> : undefined}
          />
          <Divider />
          <ListRow
            icon={BellIcon}
            title="Notifications"
            subtitle={unread ? `${unread} unread` : 'All caught up'}
            onPress={() => navigation.navigate('Notifications')}
          />
          <Divider />
          <ListRow icon={UserIcon} title="Profile" subtitle="Contact details" onPress={() => navigation.navigate('Profile')} />
          <Divider />
          <ListRow icon={LogOutIcon} title="Sign out" tone="critical" onPress={() => setConfirm(true)} />
        </Card>
        <AppText size={11} color={colors.muted} align="center" style={{ marginTop: 20 }}>
          RangerNet · Wildlife Conservation System
        </AppText>
      </Screen>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        icon={LogOutIcon}
        tone={unsynced ? 'warn' : 'default'}
        title="Sign out?"
        description={
          unsynced
            ? `${unsynced} record${unsynced === 1 ? ' is' : 's are'} still stored on this device. They stay safe and will sync after you sign in again.`
            : 'You will need your credentials to sign in again.'
        }
        actions={
          <>
            <Button
              full
              variant={unsynced ? 'warning' : 'primary'}
              onPress={async () => {
                setConfirm(false);
                await signOut();
              }}
            >
              Sign out
            </Button>
            <Button full variant="ghost" onPress={() => setConfirm(false)}>
              Cancel
            </Button>
          </>
        }
      />
    </View>
  );
}
