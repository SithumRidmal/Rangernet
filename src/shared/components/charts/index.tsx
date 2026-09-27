import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { AppText } from '../ui/AppText';

export type ChartDatum = { label: string; value: number };

export function ColumnChart({
  data,
  height = 120,
  accent = colors.forest500,
  highlightMax = false,
  unit = '',
}: {
  data: ChartDatum[];
  height?: number;
  accent?: string;
  highlightMax?: boolean;
  unit?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height }}>
        {data.map((d) => {
          const isMax = highlightMax && d.value === max && d.value > 0;
          return (
            <View key={d.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <AppText size={10} weight="semibold" color={colors.muted} lineHeight={12}>
                {Number.isInteger(d.value) ? d.value : d.value.toFixed(1)}
                {unit}
              </AppText>
              <View
                style={{
                  width: '100%',
                  borderTopLeftRadius: 5,
                  borderTopRightRadius: 5,
                  height: Math.max((d.value / max) * (height - 22), 4),
                  backgroundColor: isMax ? colors.crit : accent,
                  opacity: isMax ? 1 : 0.85,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        {data.map((d) => (
          <AppText key={d.label} size={10} color={colors.muted} align="center" numberOfLines={1} style={{ flex: 1 }} lineHeight={12}>
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export function TrendChart({
  data,
  height = 110,
  accent = colors.forest500,
}: {
  data: ChartDatum[];
  height?: number;
  accent?: string;
}) {
  const [w, setW] = useState(300);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.max(100, e.nativeEvent.layout.width));
  const max = Math.max(...data.map((d) => d.value), 1);
  const h = height - 20;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => [data.length > 1 ? i * step : w / 2, h - (d.value / max) * (h - 10) - 4] as const);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z` : '';
  const labelEvery = Math.ceil(data.length / 7);
  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={h}>
        {[0.25, 0.5, 0.75].map((g) => (
          <Line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke={colors.line} strokeWidth={1} />
        ))}
        {pts.length ? <Path d={area} fill={accent} fillOpacity={0.1} /> : null}
        {pts.length ? <Path d={line} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {data.length <= 16
          ? pts.map((p, i) => <Circle key={i} cx={p[0]} cy={p[1]} r={3} fill={colors.white} stroke={accent} strokeWidth={2} />)
          : null}
      </Svg>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {data.map((d, i) => (
          <AppText key={d.label + i} size={10} color={colors.muted} align="center" style={{ flex: 1 }} numberOfLines={1} lineHeight={12}>
            {i % labelEvery === 0 ? d.label : ''}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export function BarList({ data, accent = colors.forest500 }: { data: ChartDatum[]; accent?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => (
        <View key={d.label}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <AppText size={13} style={{ flex: 1 }} numberOfLines={1}>
              {d.label}
            </AppText>
            <AppText size={13} weight="semibold">
              {Number.isInteger(d.value) ? d.value : d.value.toFixed(1)}
            </AppText>
          </View>
          <View style={{ marginTop: 4, height: 8, borderRadius: 4, backgroundColor: colors.forest100, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${(d.value / max) * 100}%`, borderRadius: 4, backgroundColor: accent }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ProgressRing({ value, label, size = 64 }: { value: number; label?: string; size?: number }) {
  const r = size * 0.4;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.forest100} strokeWidth={7} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.forest500}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <SvgText x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={14} fontFamily={fonts.semibold} fill={colors.ink}>
          {`${Math.round(v)}%`}
        </SvgText>
      </Svg>
      {label ? (
        <AppText size={13} color={colors.muted} style={{ flex: 1 }}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}
