import React from 'react';
import { View } from 'react-native';
import { ShieldCheckIcon } from 'lucide-react-native';
import { AppText, Card } from '@shared/components';
import { colors } from '@shared/theme';

const TIPS = [
  'Keep a safe distance from elephants – never approach, chase or surround them.',
  'Do not throw stones or light crackers near an animal; move away calmly.',
  'Keep children and livestock indoors until the animal has left.',
  'Report from a safe place. Your safety comes before the photo.',
];

export function SafetyCard() {
  return (
    <Card style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.warnBg, alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheckIcon size={18} color={colors.warn} />
        </View>
        <AppText size={15} weight="semibold">
          Stay safe
        </AppText>
      </View>
      <View style={{ marginTop: 12, gap: 8 }}>
        {TIPS.map((tip) => (
          <View key={tip} style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.forest400, marginTop: 7 }} />
            <AppText size={13} color={colors.muted} lineHeight={19} style={{ flex: 1 }}>
              {tip}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}
