import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../theme';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/primitives';
import { ForestBackdrop, Logo } from './AuthBrand';
import type { AuthStackParamList } from '../AuthNavigator';

export function WelcomeScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Welcome'>) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.forest700 }}>
      <ForestBackdrop />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}>
        <Logo size={58} light />
        <AppText size={30} weight="semibold" color={colors.white} style={{ marginTop: 24 }} lineHeight={36}>
          RangerNet
        </AppText>
        <AppText size={15} color={colors.forest100} style={{ marginTop: 12, maxWidth: 290 }} lineHeight={23}>
          Protecting Wildlife Through Better Field Intelligence
        </AppText>
        <View style={{ marginTop: 32, gap: 12 }}>
          <Button full size="lg" onPress={() => navigation.navigate('SignIn')}>
            Sign In
          </Button>
          <Button full size="lg" variant="outline" onPress={() => navigation.navigate('Register')}>
            Create an account
          </Button>
          <AppText size={12} color={colors.forest200} align="center">
            Department of Wildlife Conservation · Community & field operations
          </AppText>
        </View>
      </View>
    </View>
  );
}
