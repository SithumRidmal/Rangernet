import React, { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRightIcon, ClockIcon, DownloadIcon, FileTextIcon, MapPinIcon, RouteIcon, XIcon } from 'lucide-react-native';
import { colors, radius, shadows, toneColors } from '../theme';
import { AppText } from './ui/AppText';
import { Card, StatusBadge } from './ui/primitives';
import { signedUrl } from '../media/photos';
import { initials as toInitials } from '../utils/format';

/* ------------------------------- Patrol card -------------------------------- */

export function PatrolCard({
  code,
  title,
  status,
  zone,
  date,
  distance,
  instructions,
  extra,
  onPress,
}: {
  code: string;
  title: string;
  status: string;
  zone: string;
  date: string;
  distance: string;
  instructions?: string | null;
  extra?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <AppText size={15} weight="semibold">
              {code}
            </AppText>
            <StatusBadge status={status} size="sm" />
          </View>
          <AppText size={14} weight="medium" style={{ marginTop: 4 }} numberOfLines={1}>
            {title}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <MapPinIcon size={13} color={colors.muted} />
            <AppText size={13} color={colors.muted} numberOfLines={1}>
              {zone}
            </AppText>
          </View>
        </View>
        {onPress ? <ChevronRightIcon size={18} color={colors.muted} style={{ marginTop: 4 }} /> : null}
      </View>
      {instructions ? (
        <AppText size={13} color={colors.muted} numberOfLines={2} style={{ marginTop: 8 }}>
          {instructions}
        </AppText>
      ) : null}
      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: 16,
          rowGap: 4,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingTop: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <ClockIcon size={12} color={colors.muted} />
          <AppText size={12} color={colors.muted}>
            {date}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <RouteIcon size={12} color={colors.muted} />
          <AppText size={12} color={colors.muted}>
            {distance}
          </AppText>
        </View>
        {extra}
      </View>
    </Card>
  );
}

/* ------------------------- Incident / report card --------------------------- */

export function RecordCard({
  code,
  title,
  subtitle,
  badges,
  thumbUri,
  thumbTone = 'critical',
  onPress,
}: {
  code: string;
  title: string;
  subtitle: string;
  badges: string[];
  thumbUri?: string | null;
  thumbTone?: 'critical' | 'warn' | 'default';
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ padding: 14, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <MapThumb uri={thumbUri} tone={thumbTone} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText size={13} weight="semibold" color={colors.forest600}>
            {code}
          </AppText>
          <AppText size={14} weight="medium" numberOfLines={1} style={{ marginTop: 2 }}>
            {title}
          </AppText>
          <AppText size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {badges.map((b) => (
              <StatusBadge key={b} status={b} size="sm" />
            ))}
          </View>
        </View>
      </View>
    </Card>
  );
}

function MapThumb({ uri, tone }: { uri?: string | null; tone: 'critical' | 'warn' | 'default' }) {
  const dot = tone === 'critical' ? colors.crit : tone === 'warn' ? colors.warn : colors.forest500;
  return (
    <View style={{ width: 58, height: 58, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.forest100 }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: 58, height: 58 }} />
      ) : (
        <>
          <Svg width={58} height={58} viewBox="0 0 60 60">
            <Rect width={60} height={60} fill="#E4EFE7" />
            <Path d="M0 40 C 14 30, 26 44, 60 32 L60 60 L0 60 Z" fill="#CBE0D3" />
            <Path d="M0 22 C 20 18, 30 28, 60 20" stroke="#A9CBE4" strokeWidth={4} fill="none" />
          </Svg>
          <View
            style={{
              position: 'absolute',
              left: 23,
              top: 23,
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: colors.white,
              backgroundColor: dot,
            }}
          />
        </>
      )}
    </View>
  );
}

/* -------------------------------- Person card -------------------------------- */

export function PersonCard({
  name,
  subtitle,
  detail,
  status,
  right,
  selected,
  selectable,
  onPress,
}: {
  name: string;
  subtitle?: string;
  detail?: string;
  status?: string;
  right?: React.ReactNode;
  selected?: boolean;
  selectable?: boolean;
  onPress?: () => void;
}) {
  return (
    <Card onPress={onPress} selected={selected} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={name} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppText size={14} weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
              {name}
            </AppText>
            {status ? <StatusBadge status={status} size="sm" /> : null}
          </View>
          {subtitle ? (
            <AppText size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 2 }}>
              {subtitle}
            </AppText>
          ) : null}
          {detail ? (
            <AppText size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 2 }}>
              {detail}
            </AppText>
          ) : null}
        </View>
        {selectable ? (
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
        ) : (
          right
        )}
      </View>
    </Card>
  );
}

export function Avatar({ name, size = 40, dark }: { name: string; size?: number; dark?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: dark ? 'rgba(255,255,255,0.15)' : colors.forest500,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText size={size * 0.33} weight="semibold" color={colors.white}>
        {toInitials(name)}
      </AppText>
    </View>
  );
}

/* -------------------------------- Report card -------------------------------- */

export function ReportCard({
  title,
  type,
  meta,
  onPress,
  onDownload,
}: {
  title: string;
  type: string;
  meta: string;
  onPress?: () => void;
  onDownload?: () => void;
}) {
  return (
    <Card style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' }}>
          <FileTextIcon size={18} color={colors.forest500} />
        </View>
        <Pressable onPress={onPress} style={{ flex: 1, minWidth: 0 }}>
          <AppText size={14} weight="semibold" numberOfLines={1}>
            {title}
          </AppText>
          <AppText size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 2 }}>
            {type}
          </AppText>
          <AppText size={12} color={colors.muted} numberOfLines={1} style={{ marginTop: 2 }}>
            {meta}
          </AppText>
        </Pressable>
        {onDownload ? (
          <Pressable
            onPress={onDownload}
            accessibilityLabel={`Download ${title}`}
            style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <DownloadIcon size={16} color={colors.forest600} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

/* -------------------------------- Action tile -------------------------------- */

export function ActionTile({
  icon: Icon,
  label,
  sub,
  onPress,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  sub?: string;
  onPress?: () => void;
  tone?: 'default' | 'critical' | 'warn' | 'solid';
}) {
  const solid = tone === 'solid';
  const border = solid ? colors.forest500 : tone === 'critical' ? 'rgba(216,74,74,0.3)' : tone === 'warn' ? 'rgba(232,162,58,0.3)' : colors.line;
  const iconTone = solid ? { bg: 'rgba(255,255,255,0.15)', fg: colors.white } : toneColors[tone === 'critical' ? 'critical' : tone === 'warn' ? 'warn' : 'default'];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        gap: 10,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: pressed && !solid ? colors.forest300 : border,
        backgroundColor: solid ? (pressed ? colors.forest600 : colors.forest500) : colors.white,
        padding: 14,
        ...shadows.card,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconTone.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={iconTone.fg} strokeWidth={2} />
      </View>
      <View>
        <AppText size={14} weight="semibold" color={solid ? colors.white : colors.ink}>
          {label}
        </AppText>
        {sub ? (
          <AppText size={12} color={solid ? 'rgba(255,255,255,0.8)' : colors.muted} style={{ marginTop: 2 }}>
            {sub}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/* -------------------------------- Photo thumb -------------------------------- */

const TINTS = ['#CBE0D3', '#DCE8D6', '#E4DCC8', '#C6D8C2', '#D8E3EC'];

export function PhotoThumb({
  uri,
  bucket,
  path,
  index = 0,
  size = 80,
  onRemove,
  onPress,
}: {
  uri?: string | null;
  bucket?: string;
  path?: string | null;
  index?: number;
  size?: number;
  onRemove?: () => void;
  onPress?: () => void;
}) {
  const [remote, setRemote] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!uri && bucket && path) {
      signedUrl(bucket, path).then((u) => alive && setRemote(u));
    }
    return () => {
      alive = false;
    };
  }, [uri, bucket, path]);
  const src = uri ?? remote;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Svg width="100%" height="100%" viewBox="0 0 80 80">
          <Rect width={80} height={80} fill={TINTS[index % TINTS.length]} />
          <Path d="M0 56 C 18 44, 34 62, 80 46 L80 80 L0 80 Z" fill="#A8C2A4" />
          <Circle cx={60} cy={20} r={9} fill="#EFE3C4" />
          <Path d="M10 60 l10 -14 l9 10 l12 -18 l14 22 Z" fill="#8FAE8B" />
        </Svg>
      )}
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityLabel="Remove photo"
          hitSlop={6}
          style={{
            position: 'absolute',
            right: 4,
            top: 4,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: 'rgba(23,34,28,0.7)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <XIcon size={13} color={colors.white} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
