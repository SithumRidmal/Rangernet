import React from 'react';
import { Pressable, View } from 'react-native';
import {
  BellIcon,
  CopyIcon,
  HandshakeIcon,
  RouteIcon,
  ShieldAlertIcon,
  SirenIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, toneColors, type Tone } from '../theme';
import { AppText } from '../components/ui/AppText';
import { AppBar, Screen } from '../components/ui/chrome';
import { Card, Divider, EmptyState } from '../components/ui/primitives';
import { useNotifications } from './NotificationsProvider';
import { relativeTime } from '../utils/format';
import type { AppNotification } from '../types';

const KIND: Record<string, { icon: LucideIcon; tone: Tone }> = {
  PATROL: { icon: RouteIcon, tone: 'default' },
  INCIDENT: { icon: ShieldAlertIcon, tone: 'critical' },
  CONFLICT: { icon: HandshakeIcon, tone: 'warn' },
  DUPLICATE: { icon: CopyIcon, tone: 'warn' },
  RESPONSE: { icon: SirenIcon, tone: 'critical' },
};

export function NotificationsScreen({ onOpen }: { onOpen?: (n: AppNotification) => void }) {
  const { items, loading, refresh, markRead, markAllRead, unread } = useNotifications();
  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'All caught up'}
        right={
          unread ? (
            <Pressable onPress={markAllRead} hitSlop={8} style={{ paddingHorizontal: 8 }}>
              <AppText size={13} weight="semibold" color={colors.forest500}>
                Mark all read
              </AppText>
            </Pressable>
          ) : null
        }
      />
      <Screen onRefresh={refresh} refreshing={loading}>
        {items.length === 0 ? (
          <EmptyState icon={BellIcon} title="No notifications" message="Assignments, alerts and status updates will appear here." />
        ) : (
          <Card>
            {items.map((n, i) => {
              const k = KIND[n.kind] ?? { icon: BellIcon, tone: 'info' as Tone };
              const t = toneColors[k.tone];
              const Icon = k.icon;
              return (
                <View key={n.id}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => {
                      markRead(n.id);
                      onOpen?.(n);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      gap: 12,
                      padding: 14,
                      backgroundColor: pressed ? colors.forest50 : n.read_at ? colors.white : '#F3F9F5',
                    })}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={t.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <AppText size={14} weight={n.read_at ? 'medium' : 'semibold'} style={{ flex: 1 }}>
                          {n.title}
                        </AppText>
                        <AppText size={11} color={colors.muted}>
                          {relativeTime(n.created_at)}
                        </AppText>
                      </View>
                      {n.body ? (
                        <AppText size={12} color={colors.muted} style={{ marginTop: 2 }}>
                          {n.body}
                        </AppText>
                      ) : null}
                    </View>
                    {!n.read_at ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.forest500, marginTop: 6 }} /> : null}
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </Screen>
    </View>
  );
}
