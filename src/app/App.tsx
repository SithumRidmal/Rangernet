import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { colors } from '@shared/theme';
import { isSupabaseConfigured } from '@shared/config/env';
import { ToastProvider } from '@shared/components/ui/Toast';
import { AuthProvider, useAuth } from '@shared/auth/AuthProvider';
import { AuthNavigator } from '@shared/auth/AuthNavigator';
import { SplashScreen } from '@shared/auth/screens/SplashScreen';
import { PermissionsScreen } from '@shared/auth/screens/PermissionsScreen';
import { SyncProvider } from '@shared/sync/SyncProvider';
import { NotificationsProvider } from '@shared/notifications/NotificationsProvider';
import { cacheGet, cacheSet } from '@shared/sync/localDb';
import { ROLE_MODULES, registerAllSyncHandlers } from './roleRegistry';
import { ProfileErrorScreen, SetupRequiredScreen } from './SystemScreens';

registerAllSyncHandlers();

const navTheme: Theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.forest50, primary: colors.forest500, card: colors.white, border: colors.line },
};

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ToastProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { initializing, session, profile, profileError, recovering } = useAuth();
  const signedIn = !!session && !recovering;
  const uid = signedIn ? session.user.id : null;
  const [setup, setSetup] = useState<{ uid: string; done: boolean } | null>(null);
  const setupDone = uid && setup?.uid === uid ? setup.done : null;

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    cacheGet<boolean>(`fieldSetup:${uid}`).then((v) => {
      if (alive) setSetup({ uid, done: !!v });
    });
    return () => {
      alive = false;
    };
  }, [uid]);

  if (!isSupabaseConfigured) return <SetupRequiredScreen />;

  const module = profile ? ROLE_MODULES[profile.role] : null;

  let content: React.ReactNode;
  if (initializing) content = <SplashScreen />;
  else if (!signedIn) content = <AuthNavigator />;
  else if (!profile || !module) content = profileError ? <ProfileErrorScreen message={profileError} /> : <SplashScreen message="Loading your workspace…" />;
  else if (module.needsFieldSetup && setupDone === null) content = <SplashScreen message="Loading your workspace…" />;
  else if (module.needsFieldSetup && !setupDone)
    content = (
      <PermissionsScreen
        onDone={() => {
          if (!uid) return;
          setSetup({ uid, done: true });
          cacheSet(`fieldSetup:${uid}`, true);
        }}
      />
    );
  else {
    const RoleNavigator = module.Navigator;
    content = <RoleNavigator key={profile.id} />;
  }

  return (
    <SyncProvider enabled={signedIn && !!profile}>
      <NotificationsProvider userId={uid}>
        <NavigationContainer theme={navTheme}>{content}</NavigationContainer>
      </NotificationsProvider>
    </SyncProvider>
  );
}
