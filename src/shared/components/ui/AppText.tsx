import React from 'react';
import { Text, type TextProps, type TextStyle, type StyleProp } from 'react-native';
import { colors, fonts, type FontWeight } from '../../theme';

export type AppTextProps = TextProps & {
  size?: number;
  weight?: FontWeight;
  color?: string;
  align?: TextStyle['textAlign'];
  lineHeight?: number;
  style?: StyleProp<TextStyle>;
};

export function AppText({
  size = 14,
  weight = 'regular',
  color = colors.ink,
  align,
  lineHeight,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fonts[weight],
          fontSize: size,
          color,
          textAlign: align,
          lineHeight: lineHeight ?? Math.round(size * 1.38),
        },
        style,
      ]}
    />
  );
}
