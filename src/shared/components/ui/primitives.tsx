import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRightIcon } from 'lucide-react-native';
import { colors, fonts, radius, shadows, toneColors, type Tone } from '../../theme';
import { AppText } from './AppText';

/* ---------------------------------- Button --------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'outline';

const BUTTON_VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border?: string; pressed: string }> = {
  primary: { bg: colors.forest500, fg: colors.white, pressed: colors.forest700 },
  secondary: { bg: colors.forest100, fg: colors.forest700, pressed: colors.forest200 },
  ghost: { bg: 'transparent', fg: colors.forest700, pressed: colors.forest100 },
  danger: { bg: colors.crit, fg: colors.white, pressed: '#C44242' },
  warning: { bg: colors.warn, fg: colors.white, pressed: '#D39234' },
  outline: { bg: colors.white, fg: colors.ink, border: colors.line, pressed: colors.forest50 },
};

const BUTTON_SIZES = {
  sm: { height: 36, px: 12, font: 13, radius: 10, icon: 15 },
  md: { height: 44, px: 16, font: 14, radius: 12, icon: 18 },
  lg: { height: 52, px: 20, font: 15, radius: 12, icon: 18 },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  icon: Icon,
  full,
  size = 'md',
  disabled,
  loading,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  full?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = BUTTON_VARIANTS[variant];
  const s = BUTTON_SIZES[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: s.radius,
          backgroundColor: pressed ? v.pressed : v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: isDisabled ? 0.4 : 1,
          alignSelf: full ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : Icon ? (
        <Icon size={s.icon} color={v.fg} strokeWidth={2} />
      ) : null}
      <AppText size={s.font} weight="semibold" color={v.fg}>
        {children}
      </AppText>
    </Pressable>
  );
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  children,
  onPress,
  style,
  selected,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
}) {
  const base: ViewStyle = {
    backgroundColor: selected ? colors.forest50 : colors.white,
    borderWidth: 1,
    borderColor: selected ? colors.forest500 : colors.line,
    borderRadius: radius.md,
    ...shadows.card,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { borderColor: colors.forest300 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

/* -------------------------------- Status chip ------------------------------- */

const NEUTRAL = { bg: colors.neutralBg, fg: colors.muted };
const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Assigned: { bg: colors.infoBg, fg: colors.info },
  'In Progress': { bg: colors.forest100, fg: colors.forest700 },
  Completed: { bg: colors.okBg, fg: colors.ok },
  'Pending Sync': { bg: colors.warnBg, fg: colors.warn },
  'Pending Synchronization': { bg: colors.warnBg, fg: colors.warn },
  Syncing: { bg: colors.infoBg, fg: colors.info },
  Synced: { bg: colors.okBg, fg: colors.ok },
  Incomplete: NEUTRAL,
  Failed: { bg: colors.critBg, fg: colors.crit },
  Reported: { bg: colors.infoBg, fg: colors.info },
  'Under Review': { bg: colors.warnBg, fg: colors.warn },
  Resolved: { bg: colors.okBg, fg: colors.ok },
  Closed: NEUTRAL,
  Duplicate: NEUTRAL,
  'Possible Duplicate': { bg: colors.warnBg, fg: colors.warn },
  New: { bg: colors.critBg, fg: colors.crit },
  Acknowledged: { bg: colors.infoBg, fg: colors.info },
  Responding: { bg: colors.forest100, fg: colors.forest700 },
  Available: { bg: colors.okBg, fg: colors.ok },
  'On Patrol': { bg: colors.forest100, fg: colors.forest700 },
  Offline: NEUTRAL,
  Low: NEUTRAL,
  Medium: { bg: colors.infoBg, fg: colors.info },
  High: { bg: colors.warnBg, fg: colors.warn },
  Critical: { bg: colors.critBg, fg: colors.crit },
  'High Risk': { bg: colors.critBg, fg: colors.crit },
  Reviewed: { bg: colors.okBg, fg: colors.ok },
  'Awaiting review': { bg: colors.warnBg, fg: colors.warn },
  'Route updated': { bg: colors.infoBg, fg: colors.info },
  'Recorded offline': { bg: colors.warnBg, fg: colors.warnText },
  Combined: { bg: colors.infoBg, fg: colors.info },
  PDF: { bg: colors.critBg, fg: colors.crit },
  APP: { bg: colors.forest100, fg: colors.forest700 },
  SMS: { bg: colors.infoBg, fg: colors.info },
  Manual: { bg: colors.warnBg, fg: colors.warnText },
  GPS: { bg: colors.okBg, fg: colors.ok },
};

export function StatusBadge({
  status,
  dot = true,
  size = 'md',
}: {
  status: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}) {
  const tone = STATUS_TONE[status] ?? NEUTRAL;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        borderRadius: radius.full,
        backgroundColor: tone.bg,
        paddingHorizontal: size === 'sm' ? 8 : 10,
        paddingVertical: size === 'sm' ? 2 : 4,
      }}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.fg }} /> : null}
      <AppText size={size === 'sm' ? 11 : 12} lineHeight={size === 'sm' ? 14 : 16} weight="semibold" color={tone.fg}>
        {status}
      </AppText>
    </View>
  );
}

/* ------------------------------- Metric card -------------------------------- */

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'default',
  onPress,
  style,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  tone?: Tone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = toneColors[tone];
  return (
    <Card onPress={onPress} style={[{ padding: 14, flex: 1 }, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <AppText size={12} color={colors.muted} style={{ flex: 1 }}>
          {label}
        </AppText>
        {Icon ? (
          <View style={[styles.iconTile, { width: 24, height: 24, borderRadius: 6, backgroundColor: t.bg }]}>
            <Icon size={13} color={t.fg} strokeWidth={2.2} />
          </View>
        ) : null}
      </View>
      <AppText size={22} weight="semibold" lineHeight={26} style={{ marginTop: 8 }}>
        {value}
      </AppText>
      {sub ? (
        <AppText size={11} color={colors.muted} style={{ marginTop: 6 }}>
          {sub}
        </AppText>
      ) : null}
    </Card>
  );
}

/* --------------------------------- Section --------------------------------- */

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, style]}>
      <AppText size={16} weight="semibold">
        {title}
      </AppText>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <AppText size={13} weight="semibold" color={colors.forest500}>
            {action}
          </AppText>
          <ChevronRightIcon size={14} color={colors.forest500} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------------------------- Rows ----------------------------------- */

export function ListRow({
  icon: Icon,
  title,
  subtitle,
  right,
  onPress,
  tone = 'default',
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'critical';
}) {
  const crit = tone === 'critical';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
        pressed && { backgroundColor: colors.forest50 },
      ]}
    >
      {Icon ? (
        <View style={[styles.iconTile, { backgroundColor: crit ? colors.critBg : colors.forest100 }]}>
          <Icon size={17} color={crit ? colors.crit : colors.forest500} strokeWidth={2} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText size={14} weight="medium" color={crit ? colors.crit : colors.ink} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText size={12} color={colors.muted} numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronRightIcon size={17} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;
}

/* --------------------------------- Chips ----------------------------------- */

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  labels,
  style,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ gap: 8 }}
    >
      {options.map((o) => {
        const active = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: active ? colors.forest500 : colors.line,
              backgroundColor: active ? colors.forest500 : colors.white,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <AppText size={13} weight="medium" color={active ? colors.white : colors.muted}>
              {labels?.[o] ?? o}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  labels,
  style,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', gap: 4, borderRadius: radius.md, backgroundColor: colors.forest100, padding: 4 }, style]}>
      {tabs.map((t) => {
        const active = value === t;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            style={[
              { flex: 1, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center' },
              active && { backgroundColor: colors.white, ...shadows.card },
            ]}
          >
            <AppText size={13} weight="semibold" color={active ? colors.forest700 : 'rgba(13,81,53,0.7)'} numberOfLines={1}>
              {labels?.[t] ?? t}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------- Timeline --------------------------------- */

export type TimelineEntry = {
  label: string;
  detail?: string;
  time: string;
  done: boolean;
  tone?: 'default' | 'critical' | 'warn' | 'ok';
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <View>
      {entries.map((e, i) => {
        const dotColor = !e.done
          ? colors.white
          : e.tone === 'critical'
            ? colors.crit
            : e.tone === 'warn'
              ? colors.warn
              : e.tone === 'ok'
                ? colors.ok
                : colors.forest500;
        const borderColor = e.done ? dotColor : colors.line;
        const last = i === entries.length - 1;
        return (
          <View key={e.label + i} style={{ flexDirection: 'row', gap: 12, paddingBottom: last ? 0 : 16 }}>
            {!last ? (
              <View
                style={{
                  position: 'absolute',
                  left: 7,
                  top: 16,
                  bottom: 0,
                  width: 1,
                  backgroundColor: e.done ? colors.forest300 : colors.line,
                }}
              />
            ) : null}
            <View
              style={{
                marginTop: 4,
                width: 15,
                height: 15,
                borderRadius: 8,
                borderWidth: 2,
                borderColor,
                backgroundColor: dotColor,
              }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <AppText size={14} weight="medium" color={e.done ? colors.ink : colors.muted} style={{ flex: 1 }}>
                  {e.label}
                </AppText>
                <AppText size={11} color={colors.muted}>
                  {e.time}
                </AppText>
              </View>
              {e.detail ? (
                <AppText size={12} color={colors.muted} style={{ marginTop: 2 }}>
                  {e.detail}
                </AppText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------- Empty state -------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
  tone = 'default',
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'critical' | 'warn';
}) {
  const t = toneColors[tone];
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48 }}>
      <View style={[styles.iconTile, { width: 56, height: 56, borderRadius: 16, backgroundColor: t.bg }]}>
        <Icon size={26} color={t.fg} strokeWidth={1.8} />
      </View>
      <AppText size={16} weight="semibold" align="center" style={{ marginTop: 16 }}>
        {title}
      </AppText>
      <AppText size={13} color={colors.muted} align="center" style={{ marginTop: 6, maxWidth: 260 }} lineHeight={20}>
        {message}
      </AppText>
      {actionLabel ? (
        <View style={{ marginTop: 20 }}>
          <Button variant="secondary" onPress={onAction}>
            {actionLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------- Skeleton ---------------------------------- */

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ borderRadius: 8, backgroundColor: colors.skeleton, height: 16 }, style]} />;
}

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={colors.forest500} />
      {label ? (
        <AppText size={13} color={colors.muted}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

/* ---------------------------------- Field ----------------------------------- */

export function Field({
  label,
  children,
  hint,
  error,
  required,
  style,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string | null;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
        <AppText size={13} weight="medium">
          {label}
        </AppText>
        {required ? (
          <AppText size={13} weight="medium" color={colors.crit}>
            *
          </AppText>
        ) : null}
      </View>
      {children}
      {error ? (
        <AppText size={11} color={colors.crit} style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText size={11} color={colors.muted} style={{ marginTop: 4 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export const Input = React.forwardRef<
  TextInput,
  TextInputProps & { icon?: LucideIcon; right?: React.ReactNode; invalid?: boolean }
>(function Input({ icon: Icon, right, invalid, style, multiline, onFocus, onBlur, ...rest }, ref) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: invalid ? colors.crit : focused ? colors.forest400 : colors.line,
        backgroundColor: colors.white,
        paddingHorizontal: 14,
      }}
    >
      {Icon ? <Icon size={17} color={colors.muted} style={{ marginRight: 10, marginTop: multiline ? 13 : 0 }} /> : null}
      <TextInput
        ref={ref}
        placeholderTextColor="rgba(102,115,108,0.7)"
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            flex: 1,
            fontFamily: fonts.regular,
            fontSize: 14,
            color: colors.ink,
            paddingVertical: 12,
            minHeight: multiline ? 110 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {right}
    </View>
  );
});

/* --------------------------------- Toggle ----------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 16, paddingVertical: 14 }}
    >
      <View style={{ flex: 1 }}>
        <AppText size={14} weight="medium">
          {label}
        </AppText>
        {description ? (
          <AppText size={12} color={colors.muted} style={{ marginTop: 2 }}>
            {description}
          </AppText>
        ) : null}
      </View>
      <View
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          backgroundColor: checked ? colors.forest500 : colors.toggleOff,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: colors.white,
            transform: [{ translateX: checked ? 22 : 2 }],
            ...shadows.card,
          }}
        />
      </View>
    </Pressable>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable onPress={() => onChange(!checked)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} hitSlop={6}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          borderWidth: 2,
          borderColor: checked ? colors.forest500 : colors.checkboxOff,
          backgroundColor: checked ? colors.forest500 : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.white }} /> : null}
      </View>
      <AppText size={13}>{label}</AppText>
    </Pressable>
  );
}

/* -------------------------------- Radio row --------------------------------- */

export function RadioRow({
  label,
  description,
  selected,
  onSelect,
  icon: Icon,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      onPress={onSelect}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? colors.forest500 : colors.line,
        backgroundColor: selected ? colors.forest50 : colors.white,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      {Icon ? (
        <View style={[styles.iconTile, { backgroundColor: selected ? colors.forest500 : colors.forest100 }]}>
          <Icon size={17} color={selected ? colors.white : colors.forest500} strokeWidth={2} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText size={14} weight="medium">
          {label}
        </AppText>
        {description ? (
          <AppText size={12} color={colors.muted} style={{ marginTop: 2 }}>
            {description}
          </AppText>
        ) : null}
      </View>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? colors.forest500 : colors.checkboxOff,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.forest500 }} /> : null}
      </View>
    </Pressable>
  );
}

/* -------------------------------- Key / value -------------------------------- */

export function KeyValue({
  items,
  columns = 2,
}: {
  items: { label: string; value: React.ReactNode }[];
  columns?: 1 | 2;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
      {items.map((it) => (
        <View key={it.label} style={{ width: columns === 2 ? '50%' : '100%', paddingRight: 12 }}>
          <AppText size={11} color={colors.muted} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {it.label}
          </AppText>
          {typeof it.value === 'string' || typeof it.value === 'number' ? (
            <AppText size={14} weight="medium" style={{ marginTop: 2 }}>
              {it.value}
            </AppText>
          ) : (
            <View style={{ marginTop: 2 }}>{it.value}</View>
          )}
        </View>
      ))}
    </View>
  );
}

/* ------------------------------ Inline notice -------------------------------- */

export function Notice({
  tone = 'info',
  icon: Icon,
  title,
  message,
  action,
  onAction,
  style,
}: {
  tone?: Tone;
  icon?: LucideIcon;
  title?: string;
  message: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = toneColors[tone];
  const textColor = tone === 'warn' ? colors.warnText : t.fg;
  return (
    <View style={[{ flexDirection: 'row', gap: 8, borderRadius: radius.md, backgroundColor: t.bg, paddingHorizontal: 12, paddingVertical: 10 }, style]}>
      {Icon ? <Icon size={15} color={t.fg} style={{ marginTop: 2 }} /> : null}
      <View style={{ flex: 1 }}>
        {title ? (
          <AppText size={13} weight="semibold" color={textColor}>
            {title}
          </AppText>
        ) : null}
        <AppText size={12} color={textColor} lineHeight={17}>
          {message}
        </AppText>
        {action ? (
          <Pressable onPress={onAction} hitSlop={6} style={{ marginTop: 6 }}>
            <AppText size={12} weight="semibold" color={t.fg}>
              {action}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
