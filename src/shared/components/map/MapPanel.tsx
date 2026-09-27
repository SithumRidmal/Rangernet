import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
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

export type MapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  kind: MarkerKind;
  label?: string;
  /** Short text drawn inside the marker, e.g. the waypoint order "1", "2". */
  badge?: string;
  onPress?: () => void;
};

export type MapLine = { id: string; coordinates: LatLng[]; color?: string; dashed?: boolean; width?: number };
export type MapHeat = { id: string; latitude: number; longitude: number; radiusM: number; intensity: number };

export const DEFAULT_CENTER: LatLng = { latitude: 6.3728, longitude: 81.5169 }; // Yala National Park

export function MapPanel({
  markers = [],
  lines = [],
  heat = [],
  height = 220,
  style,
  showsUserLocation,
  onPress,
  center,
  follow,
  children,
  rounded = true,
  autoFit = true,
}: {
  markers?: MapPoint[];
  lines?: MapLine[];
  heat?: MapHeat[];
  height?: number | '100%';
  style?: StyleProp<ViewStyle>;
  showsUserLocation?: boolean;
  onPress?: (c: LatLng) => void;
  center?: LatLng | null;
  /** Keep the camera on this coordinate (live patrol tracking). */
  follow?: LatLng | null;
  children?: React.ReactNode;
  rounded?: boolean;
  /** Re-fit the camera whenever the points change. Turn off for maps the user edits by tapping. */
  autoFit?: boolean;
}) {
  const ref = useRef<MapView>(null);
  const fitted = useRef(false);

  const allCoords = useMemo(() => {
    const pts: LatLng[] = markers.map((m) => ({ latitude: m.latitude, longitude: m.longitude }));
    lines.forEach((l) => pts.push(...l.coordinates));
    heat.forEach((h) => pts.push({ latitude: h.latitude, longitude: h.longitude }));
    return pts.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  }, [markers, lines, heat]);

  const fit = useCallback(() => {
    if (!ref.current) return;
    if (allCoords.length > 1) {
      ref.current.fitToCoordinates(allCoords, { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: false });
    } else if (allCoords.length === 1) {
      ref.current.animateToRegion({ ...allCoords[0], latitudeDelta: 0.03, longitudeDelta: 0.03 }, 0);
    }
  }, [allCoords]);

  useEffect(() => {
    if (autoFit && fitted.current && !follow) fit();
  }, [fit, follow, autoFit]);

  useEffect(() => {
    if (follow && ref.current) {
      ref.current.animateCamera({ center: follow }, { duration: 400 });
    }
  }, [follow]);

  const initial = center ?? allCoords[0] ?? DEFAULT_CENTER;

  return (
    <View
      style={[
        { height, overflow: 'hidden', backgroundColor: colors.mapLand },
        rounded && { borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
        style,
      ]}
    >
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType="terrain"
        initialRegion={{ ...initial, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={!!showsUserLocation}
        toolbarEnabled={false}
        onMapReady={() => {
          fitted.current = true;
          if (!follow) fit();
        }}
        onPress={onPress ? (e) => onPress(e.nativeEvent.coordinate) : undefined}
      >
        {heat.map((h) => (
          <Circle
            key={h.id}
            center={{ latitude: h.latitude, longitude: h.longitude }}
            radius={h.radiusM}
            strokeWidth={1}
            strokeColor={`rgba(216,74,74,${0.35 + h.intensity * 0.4})`}
            fillColor={h.intensity > 0.6 ? `rgba(216,74,74,${0.18 + h.intensity * 0.2})` : `rgba(232,162,58,${0.15 + h.intensity * 0.25})`}
          />
        ))}
        {lines.map((l) => (
          <Polyline
            key={l.id}
            coordinates={l.coordinates}
            strokeColor={l.color ?? colors.forest500}
            strokeWidth={l.width ?? 4}
            lineDashPattern={l.dashed ? [10, 7] : undefined}
          />
        ))}
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            onPress={m.onPress}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
            title={m.label}
          >
            <MarkerDot kind={m.kind} badge={m.badge} />
          </Marker>
        ))}
      </MapView>
      {children}
    </View>
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
