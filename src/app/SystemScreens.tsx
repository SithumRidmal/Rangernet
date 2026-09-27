import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatabaseIcon, UserXIcon } from 'lucide-react-native';
import { colors, radius } from '@shared/theme';
import { AppText } from '@shared/components/ui/AppText';
import { Button, Card } from '@shared/components/ui/primitives';
import { useAuth } from '@shared/auth/AuthProvider';

export function SetupRequiredScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50, paddingTop: insets.top + 40, paddingHorizontal: 20 }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.warnBg, alignItems: 'center', justifyContent: 'center' }}>
        <DatabaseIcon size={26} color={colors.warn} />
      </View>
      <AppText size={22} weight="semibold" style={{ marginTop: 20 }}>
        Connect RangerNet to Supabase
      </AppText>
      <AppText size={14} color={colors.muted} style={{ marginTop: 8 }} lineHeight={21}>
        The Supabase connection is not configured yet. Add your project details to the .env file in the project root,
        then restart Expo.
      </AppText>
      <Card style={{ marginTop: 20, padding: 16, gap: 6 }}>
        <AppText size={12} weight="semibold" color={colors.forest700}>
          .env
        </AppText>
        <View style={{ borderRadius: radius.sm, backgroundColor: colors.forest50, padding: 12 }}>
          <AppText size={12} color={colors.ink}>
            EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
          </AppText>
          <AppText size={12} color={colors.ink}>
            EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
          </AppText>
        </View>
        <AppText size={12} color={colors.muted}>
          Then run supabase/migrations/0001_rangernet_schema.sql in the Supabase SQL Editor.
        </AppText>
      </Card>
    </View>
  );
}

export function ProfileErrorScreen({ message }: { message: string }) {
  const { signOut, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50, paddingTop: insets.top + 40, paddingHorizontal: 20 }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.critBg, alignItems: 'center', justifyContent: 'center' }}>
        <UserXIcon size={26} color={colors.crit} />
      </View>
      <AppText size={22} weight="semibold" style={{ marginTop: 20 }}>
        Profile unavailable
      </AppText>
      <AppText size={14} color={colors.muted} style={{ marginTop: 8 }} lineHeight={21}>
        {message}
      </AppText>
      <View style={{ marginTop: 24, gap: 8 }}>
        <Button full onPress={refreshProfile}>
          Try again
        </Button>
        <Button full variant="ghost" onPress={signOut}>
          Sign out
        </Button>
      </View>
    </View>
  );
}
