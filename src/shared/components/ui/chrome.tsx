import React from 'react';
import {
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
import type { LucideIcon } from 'lucide-react-native';
import {
  ArrowLeftIcon,
  BellIcon,
  CheckCircle2Icon,
  CloudIcon,
  CloudOffIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react-native';
import { colors, radius, shadows, toneColors } from '../../theme';
import { AppText } from './AppText';
import { useSync } from '../../sync/SyncProvider';
import type { SyncStatus } from '../../sync/SynchronizationService';
import { useSharedNavigation } from '@shared/navigation/types';
import { useNotifications } from '../../notifications/NotificationsProvider';

/* --------------------------------- App bar -------------------------------- */

export function AppBar({
  title,
  subtitle,
  onBack,
  right,
  tone = 'default',
  border = true,
  hideBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  tone?: 'default' | 'dark' | 'critical';
  border?: boolean;
  hideBack?: boolean;
}) {
  const navigation = React.useContext(NavigationContext);
  const insets = useSafeAreaInsets();
  const canGoBack = navigation?.canGoBack() ?? false;
  const back = hideBack ? undefined : onBack ?? (canGoBack ? () => navigation?.goBack() : undefined);
  const bg = tone === 'dark' ? colors.forest700 : tone === 'critical' ? colors.crit : colors.white;
  const fg = tone === 'default' ? colors.ink : colors.white;
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingTop: insets.top,
        borderBottomWidth: border && tone === 'default' ? 1 : 0,
        borderBottomColor: colors.line,
      }}
    >
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
        {back ? (
          <Pressable
            onPress={back}
            accessibilityLabel="Go back"
            hitSlop={6}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? (tone === 'default' ? colors.forest100 : 'rgba(255,255,255,0.15)') : 'transparent',
            })}
          >
            <ArrowLeftIcon size={20} color={fg} />
          </Pressable>
        ) : (
          <View style={{ width: 4 }} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText size={17} weight="semibold" color={fg} numberOfLines={1} lineHeight={22}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText size={12} color={tone === 'default' ? colors.muted : 'rgba(255,255,255,0.75)'} numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  badge,
  tone = 'default',
}: {
  icon: LucideIcon;
  onPress?: () => void;
  label: string;
  badge?: number;
  tone?: 'default' | 'onDark';
}) {
  const fg = tone === 'default' ? colors.ink : colors.white;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? (tone === 'default' ? colors.forest100 : 'rgba(255,255,255,0.15)') : 'transparent',
      })}
    >
      <Icon size={20} color={fg} strokeWidth={2} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            right: 3,
            top: 3,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.crit,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <AppText size={10} weight="bold" color={colors.white} lineHeight={12}>
            {badge > 9 ? '9+' : badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function BellButton({ tone = 'default' }: { tone?: 'default' | 'onDark' }) {
  const navigation = useSharedNavigation();
  const { unread } = useNotifications();
  return (
    <IconButton
      icon={BellIcon}
      label="Notifications"
      badge={unread}
      tone={tone}
      onPress={() => navigation.navigate('Notifications')}
    />
  );
}

/* ------------------------------ Screen shell ------------------------------ */

export function Screen({
  children,
  padded = true,
  bg = colors.forest50,
  refreshing,
  onRefresh,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  padded?: boolean;
  bg?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const padding: ViewStyle = padded ? { paddingHorizontal: 16, paddingVertical: 16 } : {};
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: bg }, padding, contentStyle]}>{children}</View>;
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[padding, { flexGrow: 1 }, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.forest500} colors={[colors.forest500]} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function StickyFooter({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.line,
        backgroundColor: colors.white,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12),
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}

/* ----------------------------- Offline banner ----------------------------- */

export function OfflineBanner() {
  const { online, pending } = useSync();
  const navigation = useSharedNavigation();
  if (online) return null;
  return (
    <Pressable
      onPress={() => navigation.navigate('SyncCenter')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warnBg, paddingHorizontal: 16, paddingVertical: 8 }}
    >
      <CloudOffIcon size={15} color={colors.warn} />
      <AppText size={12} weight="medium" color={colors.warnText} style={{ flex: 1 }}>
        Working offline · {pending} record{pending === 1 ? '' : 's'} stored on this device
      </AppText>
      <AppText size={12} weight="semibold" color={colors.warn}>
        Sync Center
      </AppText>
    </Pressable>
  );
}

const SYNC_MAP: Record<SyncStatus, { icon: LucideIcon; fg: string; bg: string; label: string }> = {
  Synced: { icon: CheckCircle2Icon, fg: colors.ok, bg: colors.okBg, label: 'All data synced' },
  Offline: { icon: CloudOffIcon, fg: colors.warn, bg: colors.warnBg, label: 'Working offline' },
  'Pending Sync': { icon: CloudIcon, fg: colors.warn, bg: colors.warnBg, label: 'Pending sync' },
  Syncing: { icon: CloudIcon, fg: colors.info, bg: colors.infoBg, label: 'Syncing…' },
  Failed: { icon: TriangleAlertIcon, fg: colors.crit, bg: colors.critBg, label: 'Sync failed' },
};

export function SyncIndicator({ state, detail }: { state: SyncStatus; detail?: string }) {
  const cfg = SYNC_MAP[state];
  const Icon = cfg.icon;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderRadius: 8, backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Icon size={14} color={cfg.fg} />
      <AppText size={12} weight="semibold" color={cfg.fg}>
        {cfg.label}
      </AppText>
      {detail ? (
        <AppText size={12} color={colors.muted}>
          · {detail}
        </AppText>
      ) : null}
    </View>
  );
}

/* -------------------------------- Overlays -------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  tone = 'default',
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'critical' | 'warn';
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const t = toneColors[tone];
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay }} onPress={onClose} />
        <View style={{ width: '100%', maxWidth: 340, borderRadius: radius.lg, backgroundColor: colors.white, padding: 20, ...shadows.lift }}>
          {Icon ? (
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon size={21} color={t.fg} strokeWidth={2} />
            </View>
          ) : null}
          <AppText size={17} weight="semibold">
            {title}
          </AppText>
          {description ? (
            <AppText size={13} color={colors.muted} lineHeight={20} style={{ marginTop: 6 }}>
              {description}
            </AppText>
          ) : null}
          {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
          {actions ? <View style={{ marginTop: 20, gap: 8 }}>{actions}</View> : null}
        </View>
      </View>
    </RNModal>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay }} onPress={onClose} />
        <View
          style={{
            maxHeight: '85%',
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            backgroundColor: colors.white,
            paddingBottom: Math.max(insets.bottom, 20),
            ...shadows.sheet,
          }}
        >
          <View style={{ paddingTop: 8 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.handle }} />
            {title ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
                <AppText size={16} weight="semibold">
                  {title}
                </AppText>
                <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
                  <XIcon size={18} color={colors.muted} />
                </Pressable>
              </View>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
