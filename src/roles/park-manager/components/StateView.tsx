import React from 'react';
import { View } from 'react-native';
import { DatabaseIcon, RefreshCwIcon, type LucideIcon } from 'lucide-react-native';
import { AppBar, AppText, Button, Card, KeyValue, OfflineBanner, Screen, StickyFooter } from '@shared/components';
import { colors, radius, toneColors } from '@shared/theme';

/** Full-screen failure / exception state (design: states.tsx StateShell). */
export function StateView({
  appBarTitle = '',
  appBarSubtitle,
  icon: Icon,
  tone = 'warn',
  title,
  message,
  reassurance,
  meta,
  primaryLabel,
  onPrimary,
  primaryIcon = RefreshCwIcon,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  onBack,
}: {
  appBarTitle?: string;
  appBarSubtitle?: string;
  icon: LucideIcon;
  tone?: 'warn' | 'critical' | 'default';
  title: string;
  message: string;
  reassurance?: string;
  meta?: { label: string; value: string }[];
  primaryLabel: string;
  onPrimary: () => void;
  primaryIcon?: LucideIcon;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onBack?: () => void;
}) {
  const t = toneColors[tone];
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar title={appBarTitle} subtitle={appBarSubtitle} onBack={onBack} />
      <OfflineBanner />
      <Screen bg={colors.white} contentStyle={{ justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.lg,
              backgroundColor: t.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={28} color={t.fg} strokeWidth={1.9} />
          </View>
          <AppText size={20} weight="semibold" align="center" style={{ marginTop: 20 }}>
            {title}
          </AppText>
          <AppText size={14} color={colors.muted} align="center" lineHeight={21} style={{ marginTop: 8, maxWidth: 300 }}>
            {message}
          </AppText>
        </View>
        {reassurance ? (
          <Card style={{ marginTop: 24, padding: 16, flexDirection: 'row', gap: 12 }}>
            <DatabaseIcon size={17} color={colors.ok} style={{ marginTop: 1 }} />
            <AppText size={12.5} color={colors.muted} lineHeight={18} style={{ flex: 1 }}>
              {reassurance}
            </AppText>
          </Card>
        ) : null}
        {meta?.length ? (
          <Card style={{ marginTop: 16, padding: 16 }}>
            <KeyValue items={meta} />
          </Card>
        ) : null}
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={primaryIcon} loading={primaryLoading} onPress={onPrimary}>
          {primaryLabel}
        </Button>
        {secondaryLabel ? (
          <Button full variant="outline" onPress={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </StickyFooter>
    </View>
  );
}
