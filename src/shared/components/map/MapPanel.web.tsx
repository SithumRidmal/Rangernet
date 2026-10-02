import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows } from '../../theme';
import { AppText } from '../ui/AppText';

export type MarkerKind = 'ranger' | 'incident' | 'conflict' | 'waypoint' | 'planned' | 'destination' | 'selected' | 'hotspot';

const MARKER_STYLE: Record<MarkerKind, { fill: string; size: number }> = {
  ranger: { fill: colors.forest500, size: 18 },
  incident: { fill: colors.crit, size: 22 },
  conflict: { fill: colors.warn, size: 22 },
  waypoint: { fill: colors.info, size: 16 },
  planned: { fill: colors.forest700, size: 18 },
  destination: { fill: colors.forest700, size: 22 },
  selected: { fill: colors.crit, size: 24 },
  hotspot: { fill: colors.crit, size: 20 },
};

export type LatLng = { latitude: number; longitude: number };

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  kind: MarkerKind;
  label?: string;
  badge?: string;
  onPress?: () => void;
};

export type MapLine = { id: string; coordinates: LatLng[]; color?: string; dashed?: boolean; width?: number };
export type MapHeat = { id: string; latitude: number; longitude: number; radiusM: number; intensity: number };

export const DEFAULT_CENTER: LatLng = { latitude: 6.3728, longitude: 81.5169 };

export function MapPanel({
  markers = [],
  lines = [],
  heat = [],
  height = 220,
  style,
  onPress,
  center,
  children,
  rounded = true,
}: {
  markers?: MapPoint[];
  lines?: MapLine[];
  heat?: MapHeat[];
  height?: number | '100%';
  style?: StyleProp<ViewStyle>;
  showsUserLocation?: boolean;
  onPress?: (c: LatLng) => void;
  center?: LatLng | null;
  follow?: LatLng | null;
  children?: React.ReactNode;
  rounded?: boolean;
  autoFit?: boolean;
}) {
  const fallbackPoint = center ?? markers[0] ?? DEFAULT_CENTER;

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.({ latitude: fallbackPoint.latitude, longitude: fallbackPoint.longitude })}
      style={[
        {
          height,
          overflow: 'hidden',
          backgroundColor: colors.mapLand,
          justifyContent: 'space-between',
        },
        rounded && { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
        style,
      ]}
    >
      <View style={{ padding: 14, gap: 8 }}>
        <AppText size={13} weight="semibold" color={colors.forest700}>
          Map preview
        </AppText>
        <AppText size={12} color={colors.muted}>
          Native map tiles are available in the Android and iOS app. The web preview shows saved coordinates.
        </AppText>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 14, gap: 8 }}>
        {markers.slice(0, 4).map((m) => (
          <Pressable
            key={m.id}
            onPress={m.onPress}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderRadius: radius.sm,
              backgroundColor: 'rgba(255,255,255,0.72)',
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <MarkerDot kind={m.kind} badge={m.badge} />
            <View style={{ flex: 1 }}>
              <AppText size={12} weight="semibold" color={colors.ink}>
                {m.label ?? markerLabel(m.kind)}
              </AppText>
              <AppText size={11} color={colors.muted}>
                {formatCoord(m.latitude)}, {formatCoord(m.longitude)}
              </AppText>
            </View>
          </Pressable>
        ))}
        {!markers.length ? (
          <View
            style={{
              borderRadius: radius.sm,
              backgroundColor: 'rgba(255,255,255,0.72)',
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <AppText size={11} color={colors.muted}>
              Center: {formatCoord(fallbackPoint.latitude)}, {formatCoord(fallbackPoint.longitude)}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={{ padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {lines.length ? <MapChip label={`${lines.length} route${lines.length === 1 ? '' : 's'}`} /> : null}
        {heat.length ? <MapChip label={`${heat.length} hotspot${heat.length === 1 ? '' : 's'}`} /> : null}
        {onPress ? <MapChip label="Click to use center point" /> : null}
      </View>
      {children}
    </Pressable>
  );
}

function MarkerDot({ kind, badge }: { kind: MarkerKind; badge?: string }) {
  const s = MARKER_STYLE[kind];
  const size = badge ? Math.max(s.size, 22) : s.size;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: s.fill,
        borderWidth: 2,
        borderColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
      }}
    >
      {badge ? (
        <AppText size={10} lineHeight={12} weight="bold" color={colors.white}>
          {badge}
        </AppText>
      ) : kind !== 'ranger' ? (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white }} />
      ) : null}
    </View>
  );
}

export function MapLegend({ items, style }: { items: { color: string; label: string }[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: 12,
          rowGap: 6,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: 'rgba(255,255,255,0.95)',
          paddingHorizontal: 12,
          paddingVertical: 8,
          ...shadows.card,
        },
        style,
      ]}
    >
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i.color }} />
          <AppText size={11} color={colors.muted}>
            {i.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function MapChip({ label }: { label: string }) {
  return (
    <View style={{ borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 9, paddingVertical: 5 }}>
      <AppText size={10} color={colors.muted}>
        {label}
      </AppText>
    </View>
  );
}

function markerLabel(kind: MarkerKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function formatCoord(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : 'n/a';
}
