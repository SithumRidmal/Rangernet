import React, { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { UserIcon } from 'lucide-react-native';
import { colors, fonts, radius } from '../../theme';
import { AppText } from '../../components/ui/AppText';
import { AppBar, Screen, StickyFooter } from '../../components/ui/chrome';
import { Button, Card, Field, Input, Notice } from '../../components/ui/primitives';
import { SuccessScreen } from '../../components/ui/composite';
import { useAuth } from '../AuthProvider';
import { getErrorMessage } from '../../utils/errors';
import { maskEmail } from '../../utils/format';
import type { AuthStackParamList } from '../AuthNavigator';

export function ForgotPasswordScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>) {
  const { resolveEmail, sendRecoveryCode } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const email = await resolveEmail(identifier);
      await sendRecoveryCode(email);
      navigation.navigate('Otp', { email });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar title="Forgot password" />
      <Screen bg={colors.white}>
        <AppText size={14} color={colors.muted} lineHeight={21}>
          Enter your Employee ID or e-mail. A 6-digit verification code will be sent to the e-mail address registered with
          your account.
        </AppText>
        <View style={{ marginTop: 24, gap: 16 }}>
          <Field label="Employee ID or e-mail" required>
            <Input icon={UserIcon} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" placeholder="RNG-2291" />
          </Field>
          {error ? <Notice tone="critical" message={error} /> : null}
        </View>
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={submit} loading={busy}>
          Send Verification Code
        </Button>
      </StickyFooter>
    </View>
  );
}

export function OtpScreen({ navigation, route }: NativeStackScreenProps<AuthStackParamList, 'Otp'>) {
  const { verifyRecoveryCode, sendRecoveryCode } = useAuth();
  const { email } = route.params;
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const setDigit = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '');
    const next = [...code];
    if (digits.length > 1) {
      digits.slice(0, 6 - i).split('').forEach((d, k) => (next[i + k] = d));
      setCode(next);
      inputs.current[Math.min(5, i + digits.length)]?.focus();
      return;
    }
    next[i] = digits;
    setCode(next);
    if (digits && i < 5) inputs.current[i + 1]?.focus();
  };

  const verify = async () => {
    const token = code.join('');
    if (token.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await verifyRecoveryCode(email, token);
      navigation.navigate('ResetPassword');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar title="Verification" />
      <Screen bg={colors.white}>
        <AppText size={20} weight="semibold">
          Enter verification code
        </AppText>
        <AppText size={14} color={colors.muted} style={{ marginTop: 6 }} lineHeight={21}>
          We sent a 6-digit code to {maskEmail(email)}.
        </AppText>
        <View style={{ marginTop: 28, flexDirection: 'row', gap: 8 }}>
          {code.map((c, i) => (
            <TextInput
              key={i}
              ref={(r) => {
                inputs.current[i] = r;
              }}
              value={c}
              onChangeText={(v) => setDigit(i, v)}
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Backspace' && !code[i] && i > 0) inputs.current[i - 1]?.focus();
              }}
              keyboardType="number-pad"
              maxLength={6}
              accessibilityLabel={`Digit ${i + 1}`}
              style={{
                flex: 1,
                height: 56,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: c ? colors.forest400 : colors.line,
                textAlign: 'center',
                fontSize: 20,
                fontFamily: fonts.semibold,
                color: colors.ink,
              }}
            />
          ))}
        </View>
        <Pressable
          style={{ marginTop: 20 }}
          onPress={async () => {
            setInfo(null);
            try {
              await sendRecoveryCode(email);
              setInfo('A new code was sent.');
            } catch (e) {
              setError(getErrorMessage(e));
            }
          }}
        >
          <AppText size={13} weight="semibold" color={colors.forest500}>
            Resend code
          </AppText>
        </Pressable>
        {error ? <Notice tone="critical" message={error} style={{ marginTop: 16 }} /> : null}
        {info ? <Notice tone="ok" message={info} style={{ marginTop: 16 }} /> : null}
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={verify} loading={busy}>
          Verify
        </Button>
      </StickyFooter>
    </View>
  );
}

function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/\d/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw) || /[A-Z]/.test(pw)) s++;
  return s;
}

export function ResetPasswordScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>) {
  const { updatePassword, finishRecovery } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = strength(pw);

  const submit = async () => {
    setError(null);
    if (pw.length < 8 || !/\d/.test(pw)) return setError('Minimum 8 characters with one number.');
    if (pw !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await updatePassword(pw);
      navigation.replace('PasswordUpdated');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar
        title="Reset password"
        onBack={async () => {
          await finishRecovery();
          navigation.popToTop();
        }}
      />
      <Screen bg={colors.white}>
        <View style={{ gap: 16 }}>
          <Field label="New password" required hint="Minimum 8 characters with one number">
            <Input value={pw} onChangeText={setPw} secureTextEntry placeholder="New password" />
          </Field>
          <Field label="Confirm new password" required>
            <Input value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Repeat new password" />
          </Field>
        </View>
        <Card style={{ marginTop: 20, padding: 14 }}>
          <AppText size={13} weight="medium">
            Password strength
          </AppText>
          <View style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < s ? (s >= 3 ? colors.ok : colors.warn) : colors.line }} />
            ))}
          </View>
          <AppText size={12} color={colors.muted} style={{ marginTop: 8 }}>
            {s >= 3 ? 'Strong — avoid reusing park office passwords.' : 'Add length, numbers and symbols to strengthen it.'}
          </AppText>
        </Card>
        {error ? <Notice tone="critical" message={error} style={{ marginTop: 16 }} /> : null}
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={submit} loading={busy}>
          Update Password
        </Button>
      </StickyFooter>
    </View>
  );
}

export function PasswordUpdatedScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'PasswordUpdated'>) {
  const { finishRecovery } = useAuth();
  return (
    <SuccessScreen
      title="Password updated"
      message="Your RangerNet password was changed. Sign in with your new password to continue."
      primaryLabel="Back to Sign In"
      onPrimary={async () => {
        await finishRecovery();
        navigation.reset({ index: 1, routes: [{ name: 'Welcome' }, { name: 'SignIn' }] });
      }}
    />
  );
}
