import React, { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { colors } from '../../theme';
import { AppText } from '../../components/ui/AppText';
import { ForestBackdrop, Logo } from './AuthBrand';

export function SplashScreen({ message = 'Preparing offline field data…' }: { message?: string }) {
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [x]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.forest700 }}>
      <ForestBackdrop />
      <Logo size={72} light />
      <AppText size={28} weight="semibold" color={colors.white} style={{ marginTop: 20 }} lineHeight={34}>
        RangerNet
      </AppText>
      <AppText size={13} color={colors.forest200} style={{ marginTop: 4, letterSpacing: 1 }}>
        WILDLIFE CONSERVATION SYSTEM
      </AppText>
      <View style={{ position: 'absolute', bottom: 64, alignItems: 'center', gap: 12 }}>
        <View style={{ width: 128, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' }}>
          <Animated.View
            style={{
              width: 43,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.forest200,
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-43, 128] }) }],
            }}
          />
        </View>
        <AppText size={12} color={colors.forest200}>
          {message}
        </AppText>
      </View>
    </View>
  );
}
