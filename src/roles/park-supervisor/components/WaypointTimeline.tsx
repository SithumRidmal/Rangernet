import React from 'react';
import { View } from 'react-native';
import { AppText, StatusBadge } from '@shared/components';
import { colors } from '@shared/theme';
import { formatCoord, formatTime } from '@shared/utils/format';
import type { Waypoint } from '../models';

/** Timeline of waypoints with manual / GPS badge (design: route waypoints timeline). */
export function WaypointTimeline({ waypoints, planned }: { waypoints: Waypoint[]; planned?: boolean }) {
  return (
    <View>
      {waypoints.map((w, i) => {
        const last = i === waypoints.length - 1;
        return (
          <View key={w.waypointId} style={{ flexDirection: 'row', gap: 12, paddingBottom: last ? 0 : 16 }}>
            {!last ? (
              <View style={{ position: 'absolute', left: 10, top: 22, bottom: 0, width: 1, backgroundColor: colors.forest300 }} />
            ) : null}
            <View
              style={{
                width: 21,
                height: 21,
                borderRadius: 11,
                marginTop: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: planned ? colors.forest700 : colors.info,
              }}
            >
              <AppText size={10} weight="bold" color={colors.white} lineHeight={12}>
                {i + 1}
              </AppText>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText size={14} weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                  {w.note || (planned ? `Planned waypoint ${i + 1}` : `Waypoint ${i + 1}`)}
                </AppText>
                {!planned ? (
                  <AppText size={11} color={colors.muted}>
                    {formatTime(w.timestamp)}
                  </AppText>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                {!planned ? <StatusBadge status={w.manuallyMarked ? 'Manual' : 'GPS'} size="sm" dot={false} /> : null}
                <AppText size={12} color={colors.muted}>
                  {formatCoord(w.latitude, w.longitude)}
                </AppText>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
