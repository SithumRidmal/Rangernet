import React from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { CheckCircle2Icon } from 'lucide-react-native';
import { colors, radius } from '../../theme';
import { AppText } from './AppText';
import { Button } from './primitives';
import { AppBar, Screen, StickyFooter } from './chrome';

export function SuccessScreen({
  title,
  message,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  meta,
  tone = 'ok',
  icon: Icon = CheckCircle2Icon,
}: {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  meta?: { label: string; value: string }[];
  tone?: 'ok' | 'warn';
  icon?: LucideIcon;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <Screen bg={colors.white} contentStyle={{ alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone === 'ok' ? colors.okBg : colors.warnBg,
          }}
        >
          <Icon size={40} color={tone === 'ok' ? colors.ok : colors.warn} strokeWidth={1.8} />
        </View>
        <AppText size={22} weight="semibold" align="center" style={{ marginTop: 24 }}>
          {title}
        </AppText>
        <AppText size={14} color={colors.muted} align="center" lineHeight={21} style={{ marginTop: 8, maxWidth: 300 }}>
          {message}
        </AppText>
        {meta && meta.length ? (
          <View
            style={{
              marginTop: 24,
              width: '100%',
              maxWidth: 320,
              gap: 8,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.forest50,
              padding: 16,
            }}
          >
            {meta.map((m) => (
              <View key={m.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <AppText size={13} color={colors.muted}>
                  {m.label}
                </AppText>
                <AppText size={13} weight="semibold" style={{ flexShrink: 1 }} align="right">
                  {m.value}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={onPrimary}>
          {primaryLabel}
        </Button>
        {secondaryLabel ? (
          <Button full variant="ghost" onPress={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </StickyFooter>
    </View>
  );
}

export function WizardHeader({
  step,
  total,
  title,
  context,
  onBack,
}: {
  step: number;
  total: number;
  title: string;
  context: string;
  onBack?: () => void;
}) {
  return (
    <View style={{ backgroundColor: colors.white }}>
      <AppBar title={title} subtitle={`Step ${step} of ${total} · ${context}`} onBack={onBack} border={false} />
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 12 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? colors.forest500 : colors.line }}
          />
        ))}
      </View>
    </View>
  );
}

export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? colors.forest500 : colors.line }} />
      ))}
    </View>
  );
}
