import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText, MapLegend, MapPanel, type MapLine, type MapPoint } from '@shared/components';
import { colors } from '@shared/theme';
import type { Patrol } from '../models';

/** Planned route (dashed), recorded GPS track and marked waypoints of one patrol. */
export function PatrolRouteMap({ patrol, height = 240 }: { patrol: Patrol; height?: number }) {
  const route = patrol.getRoute();
  const { markers, lines, legend } = useMemo(() => {
    const planned = route.getPlannedWaypoints();
    const track = route.getTrack();
    const marked = route.getMarkedWaypoints();
    const m: MapPoint[] = [];
    const l: MapLine[] = [];
    const lg: { color: string; label: string }[] = [];

    if (planned.length) {
      l.push({ id: 'planned', coordinates: planned.map((w) => w.getLocation()), color: colors.forest700, dashed: true, width: 3 });
      planned.forEach((w, i) =>
        m.push({ id: `p-${w.waypointId}`, ...w.getLocation(), kind: 'planned', badge: String(i + 1), label: `Planned waypoint ${i + 1}${w.note ? ` · ${w.note}` : ''}` }),
      );
      lg.push({ color: colors.forest700, label: 'Planned route' });
    }
    if (track.length > 1) {
      l.push({ id: 'track', coordinates: track.map((w) => w.getLocation()), color: colors.forest400, width: 4 });
      lg.push({ color: colors.forest400, label: 'GPS track' });
    }
    marked.forEach((w, i) =>
      m.push({ id: `m-${w.waypointId}`, ...w.getLocation(), kind: 'waypoint', label: `Waypoint ${i + 1}${w.note ? ` · ${w.note}` : ''}` }),
    );
    if (marked.length) lg.push({ color: colors.info, label: 'Marked waypoint' });

    if (track.length) {
      const last = track[track.length - 1];
      if (patrol.status === 'In Progress') {
        m.push({ id: 'last', ...last.getLocation(), kind: 'ranger', label: 'Last known position' });
        lg.push({ color: colors.forest500, label: 'Ranger' });
      } else {
        m.push({ id: 'start', ...track[0].getLocation(), kind: 'ranger', label: 'Start' });
        if (track.length > 1) m.push({ id: 'end', ...last.getLocation(), kind: 'destination', label: 'End' });
      }
    }
    return { markers: m, lines: l, legend: lg };
  }, [route, patrol.status]);

  return (
    <MapPanel markers={markers} lines={lines} height={height} rounded={false}>
      {legend.length ? (
        <View style={{ position: 'absolute', left: 10, bottom: 10, right: 10 }} pointerEvents="none">
          <MapLegend items={legend} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
      {!markers.length ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 10, left: 10, right: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.95)', padding: 10 }}
        >
          <AppText size={12} color={colors.muted} align="center">
            No route or GPS positions recorded for this patrol yet.
          </AppText>
        </View>
      ) : null}
    </MapPanel>
  );
}
