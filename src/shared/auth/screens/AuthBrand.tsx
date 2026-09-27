import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { TreePineIcon } from 'lucide-react-native';
import { colors } from '../../theme';

export function Logo({ size = 56, light = false }: { size?: number; light?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        backgroundColor: light ? colors.white : colors.forest500,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <TreePineIcon size={size * 0.52} color={light ? colors.forest600 : colors.white} strokeWidth={1.9} />
    </View>
  );
}

export function ForestBackdrop() {
  return (
    <Svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%">
      <Rect width={390} height={844} fill={colors.forest700} />
      <Path d="M0 620 C 90 580, 150 660, 230 620 S 340 570, 390 610 L390 844 L0 844 Z" fill={colors.forest800} />
      <Path d="M0 720 C 80 690, 170 760, 260 720 S 350 690, 390 716 L390 844 L0 844 Z" fill={colors.forest900} />
      <G opacity={0.16}>
        {Array.from({ length: 28 }).map((_, i) => (
          <Circle key={i} cx={(i * 67) % 390} cy={(i * 131) % 560} r={(i % 3) + 1} fill={colors.forest100} />
        ))}
      </G>
    </Svg>
  );
}
