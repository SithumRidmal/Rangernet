import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  forest50: '#F7FAF8',
  forest100: '#EAF5EE',
  forest200: '#D3E8DC',
  forest300: '#A9D2BD',
  forest400: '#5FAE8A',
  forest500: '#176B45',
  forest600: '#125B3A',
  forest700: '#0D5135',
  forest800: '#0A3D28',
  forest900: '#07291B',

  ink: '#17221C',
  muted: '#66736C',
  line: '#E2EAE5',
  white: '#FFFFFF',
  neutralBg: '#F1F3F2',
  skeleton: '#E9EFEB',
  toggleOff: '#D6DED9',
  checkboxOff: '#CBD5CE',
  handle: '#DCE4DF',
  overlay: 'rgba(23,34,28,0.45)',

  crit: '#D84A4A',
  critBg: '#FBEAEA',
  warn: '#E8A23A',
  warnBg: '#FDF3E3',
  warnText: '#8A6520',
  ok: '#2E9E6B',
  okBg: '#E7F5EE',
  info: '#3B72C4',
  infoBg: '#EAF1FB',

  mapLand: '#E9F0E6',
} as const;

export const radius = { sm: 10, md: 12, lg: 16, xl: 20, full: 999 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type FontWeight = keyof typeof fonts;

function shadow(y: number, blur: number, opacity: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#17221C',
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
    },
    default: { elevation },
  }) as ViewStyle;
}

export const shadows = {
  card: shadow(1, 2, 0.06, 1),
  lift: shadow(6, 20, 0.1, 6),
  sheet: shadow(-10, 34, 0.18, 12),
};

export const type = {
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.ink } as TextStyle,
  h1: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, color: colors.ink } as TextStyle,
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, color: colors.ink } as TextStyle,
  section: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, color: colors.ink } as TextStyle,
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink } as TextStyle,
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted } as TextStyle,
  tiny: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 14, color: colors.muted } as TextStyle,
};

export type Tone = 'default' | 'critical' | 'warn' | 'ok' | 'info';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  default: { fg: colors.forest500, bg: colors.forest100 },
  critical: { fg: colors.crit, bg: colors.critBg },
  warn: { fg: colors.warn, bg: colors.warnBg },
  ok: { fg: colors.ok, bg: colors.okBg },
  info: { fg: colors.info, bg: colors.infoBg },
};
