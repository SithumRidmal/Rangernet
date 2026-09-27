import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2Icon, CircleAlertIcon, CloudIcon } from 'lucide-react-native';
import { colors, radius, shadows } from '../../theme';
import { AppText } from './AppText';

type ToastTone = 'default' | 'ok' | 'warn' | 'critical';
type ToastState = { id: number; message: string; tone: ToastTone } | null;

const ToastContext = createContext<{ show: (message: string, tone?: ToastTone) => void } | null>(null);

const TONE_BG: Record<ToastTone, string> = {
  default: colors.ink,
  ok: colors.forest700,
  warn: colors.warnText,
  critical: colors.crit,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, tone: ToastTone = 'default') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: Date.now(), message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setToast(null));
      }, 3200);
    },
    [opacity],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const Icon = toast?.tone === 'critical' ? CircleAlertIcon : toast?.tone === 'ok' ? CheckCircle2Icon : CloudIcon;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 74,
            opacity,
            transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderRadius: radius.md,
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: TONE_BG[toast.tone],
              ...shadows.lift,
            }}
          >
            <Icon size={17} color={colors.white} />
            <AppText size={13} weight="medium" color={colors.white} style={{ flex: 1 }}>
              {toast.message}
            </AppText>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
