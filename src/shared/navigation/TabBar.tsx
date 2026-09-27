import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { colors } from '../theme';
import { AppText } from '../components/ui/AppText';

export type TabIconMap = Record<string, { label: string; icon: LucideIcon }>;

/** Bottom navigation styled after the RangerNet design (active indicator bar on top). */
export function RoleTabBar({ state, navigation, icons }: BottomTabBarProps & { icons: TabIconMap }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.line,
        backgroundColor: 'rgba(255,255,255,0.97)',
        paddingBottom: Math.max(insets.bottom, 6),
      }}
    >
      <View style={{ height: 58, flexDirection: 'row', paddingHorizontal: 4 }}>
        {state.routes.map((route, index) => {
          const active = state.index === index;
          const cfg = icons[route.name];
          if (!cfg) return null;
          const Icon = cfg.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!active && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 4 }}
            >
              {active ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: 32,
                    height: 3,
                    borderBottomLeftRadius: 3,
                    borderBottomRightRadius: 3,
                    backgroundColor: colors.forest500,
                  }}
                />
              ) : null}
              <Icon size={20} strokeWidth={active ? 2.3 : 1.9} color={active ? colors.forest500 : colors.muted} />
              <AppText size={10.5} lineHeight={13} weight="medium" color={active ? colors.forest600 : colors.muted}>
                {cfg.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
