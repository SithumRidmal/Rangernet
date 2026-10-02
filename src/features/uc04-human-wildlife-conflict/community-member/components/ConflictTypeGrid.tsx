import React from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@shared/components';
import { colors, radius } from '@shared/theme';
import type { ConflictType } from '../models/ConflictType';
import { conflictVisual } from './conflictVisuals';

export function ConflictTypeGrid({
  types,
  selectedId,
  onSelect,
}: {
  types: ConflictType[];
  selectedId: number | null;
  onSelect: (t: ConflictType) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {types.map((t) => {
        const active = selectedId === t.typeId;
        const { icon: Icon, hint } = conflictVisual(t.typeId);
        return (
          <Pressable
            key={t.typeId}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(t)}
            style={({ pressed }) => ({
              width: '48.5%',
              minHeight: 124,
              justifyContent: 'space-between',
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: active ? colors.forest500 : pressed ? colors.forest300 : colors.line,
              backgroundColor: active ? colors.forest50 : colors.white,
              padding: 12,
              gap: 12,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.forest500 : colors.forest100,
              }}
            >
              <Icon size={20} color={active ? colors.white : colors.forest500} strokeWidth={2} />
            </View>
            <View>
              <AppText size={14} weight="semibold" lineHeight={18}>
                {t.getTypeName()}
              </AppText>
              <AppText size={11.5} color={colors.muted} lineHeight={15} style={{ marginTop: 2 }}>
                {hint}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
