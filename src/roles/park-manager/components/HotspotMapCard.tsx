import React from 'react';
import { View } from 'react-native';
import { MapPinIcon } from 'lucide-react-native';
import { AppText, Card, Divider, MapLegend, MapPanel, Notice, SectionHeader } from '@shared/components';
import { colors } from '@shared/theme';
import { formatCoord } from '@shared/utils/format';
import type { HeatCell, Hotspot } from '../models/types';
import { HOTSPOT_CELL_DEG } from '../services/AnalysisEngine';

const CELL_RADIUS_M = Math.round(HOTSPOT_CELL_DEG * 111_000 * 0.5);

/** Heat map of clustered records plus the ranked hotspot list. */
export function HotspotMapCard({
  title,
  hotspots,
  heat,
  noun,
}: {
  title: string;
  hotspots: Hotspot[];
  heat: HeatCell[];
  noun: string;
}) {
  return (
    <View style={{ marginTop: 20 }}>
      <SectionHeader title={title} />
      {hotspots.length === 0 ? (
        <Notice tone="info" icon={MapPinIcon} message={`None of the ${noun} in this range have map coordinates, so no hotspots could be identified.`} />
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <MapPanel
            height={230}
            rounded={false}
            heat={heat.map((h) => ({
              id: h.id,
              latitude: h.latitude,
              longitude: h.longitude,
              radiusM: CELL_RADIUS_M * (0.6 + h.intensity * 0.6),
              intensity: h.intensity,
            }))}
            markers={hotspots.map((h) => ({
              id: `hs-${h.rank}`,
              latitude: h.latitude,
              longitude: h.longitude,
              kind: 'hotspot' as const,
              label: `#${h.rank} · ${h.count} ${noun}`,
            }))}
          >
            <View style={{ position: 'absolute', left: 8, bottom: 8 }}>
              <MapLegend
                items={[
                  { color: colors.warn, label: 'Moderate' },
                  { color: colors.crit, label: 'High' },
                ]}
              />
            </View>
          </MapPanel>
          {hotspots.map((h) => (
            <View key={h.rank}>
              <Divider />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: h.rank === 1 ? colors.crit : h.intensity > 0.6 ? colors.critBg : colors.warnBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppText size={12} weight="bold" color={h.rank === 1 ? colors.white : h.intensity > 0.6 ? colors.crit : colors.warnText}>
                    {h.rank}
                  </AppText>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText size={14} weight="medium" numberOfLines={1}>
                    Near {h.zoneName}
                  </AppText>
                  <AppText size={12} color={colors.muted} numberOfLines={1}>
                    {h.parkName} · {formatCoord(h.latitude, h.longitude)}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText size={15} weight="semibold">
                    {h.count}
                  </AppText>
                  <AppText size={11} color={colors.muted}>
                    {h.share}%
                  </AppText>
                </View>
              </View>
            </View>
          ))}
          <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
            <AppText size={11} color={colors.muted}>
              Hotspots are ~1 km grid cells ranked by the number of located {noun}.
            </AppText>
          </View>
        </Card>
      )}
    </View>
  );
}
