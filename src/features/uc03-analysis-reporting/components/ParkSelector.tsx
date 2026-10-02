import React from 'react';
import { Pressable, View } from 'react-native';
import { CheckIcon } from 'lucide-react-native';
import { AppText, Card, Divider } from '@shared/components';
import { colors } from '@shared/theme';
import type { Park } from '@shared/types';

/** Park multi-select (selecting 2+ parks switches to the "Multiple Parks" combined analysis). */
export function ParkSelector({
  parks,
  selected,
  onToggle,
  invalid,
}: {
  parks: Park[];
  selected: string[];
  onToggle: (parkId: string) => void;
  invalid?: boolean;
}) {
  return (
    <Card style={invalid ? { borderColor: colors.crit } : undefined}>
      {parks.map((p, i) => {
        const checked = selected.includes(p.park_id);
        return (
          <View key={p.park_id}>
            {i > 0 ? <Divider /> : null}
            <Pressable
              onPress={() => onToggle(p.park_id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: pressed ? colors.forest50 : 'transparent',
              })}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: checked ? colors.forest500 : colors.checkboxOff,
                  backgroundColor: checked ? colors.forest500 : colors.white,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {checked ? <CheckIcon size={13} color={colors.white} strokeWidth={3} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <AppText size={14} weight="medium">
                  {p.name}
                </AppText>
                {p.region ? (
                  <AppText size={12} color={colors.muted}>
                    {p.region}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}
