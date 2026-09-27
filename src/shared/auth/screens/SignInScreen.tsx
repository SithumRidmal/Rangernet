import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EyeIcon, EyeOffIcon, LockKeyholeIcon, ShieldCheckIcon, UserIcon } from 'lucide-react-native';
import { colors, radius } from '../../theme';
import { AppText } from '../../components/ui/AppText';
import { AppBar, Screen } from '../../components/ui/chrome';
import { Button, Field, Input } from '../../components/ui/primitives';
import { Logo } from './AuthBrand';
import { useAuth } from '../AuthProvider';
import { getErrorMessage } from '../../utils/errors';
import type { AuthStackParamList } from '../AuthNavigator';

export function SignInScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'SignIn'>) {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Enter your Employee ID (or e-mail) and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(identifier, password);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar title="" border={false} />
      <Screen bg={colors.white}>
        <View style={{ paddingHorizontal: 4 }}>
          <Logo size={48} />
          <AppText size={24} weight="semibold" style={{ marginTop: 20 }} lineHeight={30}>
            Sign in to RangerNet
          </AppText>
          <AppText size={14} color={colors.muted} style={{ marginTop: 6 }}>
            Staff sign in with their Employee ID. Community members use their e-mail.
          </AppText>

          <View style={{ marginTop: 28, gap: 16 }}>
            <Field label="Employee ID or e-mail" required>
              <Input
                icon={UserIcon}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="RNG-2291 or name@example.com"
                accessibilityLabel="Employee ID or e-mail"
              />
            </Field>
            <Field label="Password" required>
              <Input
                icon={LockKeyholeIcon}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!show}
                placeholder="Password"
                accessibilityLabel="Password"
                onSubmitEditing={submit}
                right={
                  <Pressable onPress={() => setShow((s) => !s)} hitSlop={8} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOffIcon size={17} color={colors.muted} /> : <EyeIcon size={17} color={colors.muted} />}
                  </Pressable>
                }
              />
            </Field>

            {error ? (
              <View style={{ flexDirection: 'row', gap: 8, borderRadius: radius.md, backgroundColor: colors.critBg, paddingHorizontal: 12, paddingVertical: 10 }}>
                <ShieldCheckIcon size={15} color={colors.crit} style={{ marginTop: 2 }} />
                <AppText size={12} color={colors.crit} style={{ flex: 1 }}>
                  {error}
                </AppText>
              </View>
            ) : null}

            <View style={{ alignItems: 'flex-end' }}>
              <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={6}>
                <AppText size={13} weight="semibold" color={colors.forest500}>
                  Forgot password?
                </AppText>
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: 28, gap: 12 }}>
            <Button full size="lg" onPress={submit} loading={busy}>
              Sign In
            </Button>
            <Pressable onPress={() => navigation.navigate('Register')} style={{ alignItems: 'center', paddingVertical: 4 }}>
              <AppText size={13} color={colors.muted}>
                New to RangerNet?{' '}
                <AppText size={13} weight="semibold" color={colors.forest500}>
                  Create an account
                </AppText>
              </AppText>
            </Pressable>
          </View>

          <View style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, backgroundColor: colors.forest50, paddingHorizontal: 14, paddingVertical: 12 }}>
            <LockKeyholeIcon size={15} color={colors.forest500} />
            <AppText size={12} color={colors.muted} style={{ flex: 1 }}>
              Field data captured on this device stays available without a network connection and syncs automatically.
            </AppText>
          </View>
        </View>
      </Screen>
    </View>
  );
}
