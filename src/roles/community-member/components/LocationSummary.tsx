import React from 'react';
import { View } from 'react-native';
import { MapPinIcon } from 'lucide-react-native';
import { AppText, MapPanel, StatusBadge } from '@shared/components';
import type { Location } from '@shared/models/Location';
import { colors } from '@shared/theme';
import { formatCoord } from '@shared/utils/format';

export function locationText(location: Location | null): string {
  if (!location) return 'No location';
  if (location.hasCoordinates()) return formatCoord(location.latitude, location.longitude);
  return location.locationDescription || 'No location';
}

/** Map preview (when coordinates exist) plus coordinates, accuracy, source and description. */
export function LocationSummary({ location, mapHeight = 170 }: { location: Location; mapHeight?: number }) {
  const hasCoords = location.hasCoordinates();
  return (
    <View style={{ gap: 12 }}>
      {hasCoords ? (
        <MapPanel
          height={mapHeight}
          center={{ latitude: location.latitude as number, longitude: location.longitude as number }}
          markers={[
            {
              id: 'conflict',
              latitude: location.latitude as number,
              longitude: location.longitude as number,
              kind: 'conflict',
              label: 'Conflict location',
            },
          ]}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <MapPinIcon size={17} color={colors.forest500} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 2 }}>
          {hasCoords ? (
            <AppText size={14} weight="medium">
              {formatCoord(location.latitude, location.longitude)}
            </AppText>
          ) : null}
          {hasCoords && location.accuracy !== null && !location.manuallyMarked ? (
            <AppText size={12} color={colors.muted}>
              Accuracy ±{Math.round(location.accuracy)} m
            </AppText>
          ) : null}
          {location.locationDescription ? (
            <AppText size={hasCoords ? 12 : 14} weight={hasCoords ? 'regular' : 'medium'} color={hasCoords ? colors.muted : colors.ink}>
              {location.locationDescription}
            </AppText>
          ) : null}
        </View>
        <StatusBadge status={location.manuallyMarked ? 'Manual' : 'GPS'} size="sm" dot={false} />
      </View>
    </View>
  );
}
