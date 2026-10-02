import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarIcon } from 'lucide-react-native';
import { AppText, Avatar, BellButton } from '@shared/components';
import { colors } from '@shared/theme';
import { firstName } from '@shared/utils/format';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function greeting(d: Date): string {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Dark forest header of the manager home (design: manager.tsx ManagerHome). */
export function HomeHeader({ name, subtitle }: { name: string; subtitle: string }) {
  const insets = useSafeAreaInsets();
  const now = new Date();
  return (
    <View style={{ backgroundColor: colors.forest700, paddingTop: insets.top + 12, paddingBottom: 16, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={{ borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}>
            <Avatar name={name} size={44} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText size={17} weight="semibold" color={colors.white} numberOfLines={1}>
              {greeting(now)}, {firstName(name) || 'Manager'}
            </AppText>
            <AppText size={12} color={colors.forest200} numberOfLines={1}>
              {subtitle}
            </AppText>
          </View>
        </View>
        <BellButton tone="onDark" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <CalendarIcon size={13} color={colors.forest200} />
        <AppText size={12} color={colors.forest200}>
          {`${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()} · Operations overview`}
        </AppText>
      </View>
    </View>
  );
}
