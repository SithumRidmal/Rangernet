import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BadgeCheckIcon,
  ChartNoAxesCombinedIcon,
  HandshakeIcon,
  HouseIcon,
  LockKeyholeIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
  UserIcon,
  type LucideIcon,
} from 'lucide-react-native';
import { colors } from '../../theme';
import { AppText } from '../../components/ui/AppText';
import { AppBar, Screen, StickyFooter } from '../../components/ui/chrome';
import { Button, Field, FilterChips, Input, Notice, RadioRow } from '../../components/ui/primitives';
import { useAuth } from '../AuthProvider';
import { useLookups } from '../../lookups/useLookups';
import { supabase } from '../../lib/supabase';
import { getErrorMessage } from '../../utils/errors';
import { ROLE_LABELS, type AppRole } from '../../types';
import type { AuthStackParamList } from '../AuthNavigator';

const ROLE_OPTIONS: { role: AppRole; icon: LucideIcon; description: string }[] = [
  { role: 'community_member', icon: HouseIcon, description: 'Report human-wildlife conflicts near your village.' },
  { role: 'ranger', icon: ShieldIcon, description: 'Report incidents and conduct assigned patrols.' },
  { role: 'park_supervisor', icon: BadgeCheckIcon, description: 'Assign patrol routes and monitor coverage.' },
  { role: 'community_liaison_officer', icon: HandshakeIcon, description: 'Review community reports and coordinate responses.' },
  { role: 'park_manager', icon: ChartNoAxesCombinedIcon, description: 'Analyse conservation data and generate reports.' },
];

export function RegisterScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Register'>) {
  const { signUp } = useAuth();
  const { parks } = useLookups();
  const [allowStaff, setAllowStaff] = useState(true);
  const [role, setRole] = useState<AppRole>('community_member');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [contact, setContact] = useState('');
  const [village, setVillage] = useState('');
  const [assignedArea, setAssignedArea] = useState('');
  const [parkId, setParkId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('allow_staff_self_signup')
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.allow_staff_self_signup === false) setAllowStaff(false);
      });
  }, []);

  const staff = role !== 'community_member';
  const options = allowStaff ? ROLE_OPTIONS : ROLE_OPTIONS.filter((o) => o.role === 'community_member');
  const parkCodes = useMemo(() => ['', ...parks.map((p) => p.park_id)], [parks]);
  const parkLabels = useMemo(
    () => Object.fromEntries([['', 'Not set'], ...parks.map((p) => [p.park_id, p.name])]) as Record<string, string>,
    [parks],
  );

  const submit = async () => {
    setError(null);
    if (!fullName.trim()) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid e-mail address.');
    if (password.length < 8 || !/\d/.test(password)) return setError('Password must be at least 8 characters and include a number.');
    if (password !== confirm) return setError('Passwords do not match.');
    if (role === 'community_member' && !contact.trim()) return setError('Enter your contact number.');
    if (role === 'community_member' && !village.trim()) return setError('Enter your village.');
    if (role === 'community_liaison_officer' && !assignedArea.trim()) return setError('Enter your assigned area.');
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({
        email,
        password,
        role,
        fullName,
        employeeId: staff ? employeeId : undefined,
        contactNumber: contact,
        village: role === 'community_member' ? village : undefined,
        assignedArea: role === 'community_liaison_officer' ? assignedArea : undefined,
        parkId: staff ? parkId || null : null,
      });
      if (needsConfirmation) navigation.replace('RegisterSuccess', { email: email.trim().toLowerCase() });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar title="Create account" subtitle="RangerNet access" />
      <Screen bg={colors.white}>
        <AppText size={14} weight="semibold" style={{ marginBottom: 10 }}>
          I am a…
        </AppText>
        <View style={{ gap: 8 }}>
          {options.map((o) => (
            <RadioRow
              key={o.role}
              icon={o.icon}
              label={ROLE_LABELS[o.role]}
              description={o.description}
              selected={role === o.role}
              onSelect={() => setRole(o.role)}
            />
          ))}
        </View>
        {!allowStaff ? (
          <Notice
            tone="info"
            style={{ marginTop: 10 }}
            message="Staff accounts are created by the park office. Contact your supervisor for access."
          />
        ) : null}

        <View style={{ marginTop: 24, gap: 16 }}>
          <Field label="Full name" required>
            <Input icon={UserIcon} value={fullName} onChangeText={setFullName} placeholder="e.g. Nuwan Silva" />
          </Field>
          <Field label="E-mail" required>
            <Input icon={MailIcon} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" />
          </Field>
          {staff ? (
            <Field label="Employee ID" hint="Leave empty to have one generated (e.g. RNG-1234). Used to sign in.">
              <Input icon={BadgeCheckIcon} value={employeeId} onChangeText={setEmployeeId} autoCapitalize="characters" placeholder="RNG-2291" />
            </Field>
          ) : null}
          <Field label="Contact number" required={role === 'community_member'} hint={role === 'community_member' ? 'Used to match reports you send by SMS.' : undefined}>
            <Input icon={PhoneIcon} value={contact} onChangeText={setContact} keyboardType="phone-pad" placeholder="+94 71 000 0000" />
          </Field>
          {role === 'community_member' ? (
            <Field label="Village" required>
              <Input icon={HouseIcon} value={village} onChangeText={setVillage} placeholder="e.g. Kirinda" />
            </Field>
          ) : null}
          {role === 'community_liaison_officer' ? (
            <Field label="Assigned area" required>
              <Input value={assignedArea} onChangeText={setAssignedArea} placeholder="e.g. Community Boundary North" />
            </Field>
          ) : null}
          {staff && parks.length ? (
            <Field label="Park">
              <FilterChips options={parkCodes} value={parkId} onChange={setParkId} labels={parkLabels} />
            </Field>
          ) : null}
          <Field label="Password" required hint="Minimum 8 characters with one number">
            <Input icon={LockKeyholeIcon} value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
          </Field>
          <Field label="Confirm password" required>
            <Input icon={LockKeyholeIcon} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Repeat password" />
          </Field>
          {error ? <Notice tone="critical" message={error} /> : null}
        </View>
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={submit} loading={busy}>
          Create account
        </Button>
      </StickyFooter>
    </View>
  );
}

export function RegisterSuccessScreen({ navigation, route }: NativeStackScreenProps<AuthStackParamList, 'RegisterSuccess'>) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <Screen bg={colors.white} contentStyle={{ justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.okBg, alignItems: 'center', justifyContent: 'center' }}>
          <MailIcon size={36} color={colors.ok} />
        </View>
        <AppText size={22} weight="semibold" align="center" style={{ marginTop: 24 }}>
          Confirm your e-mail
        </AppText>
        <AppText size={14} color={colors.muted} align="center" style={{ marginTop: 8, maxWidth: 300 }} lineHeight={21}>
          We sent a confirmation link to {route.params.email}. Open it, then sign in to RangerNet.
        </AppText>
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={() => navigation.navigate('SignIn')}>
          Back to Sign In
        </Button>
      </StickyFooter>
    </View>
  );
}
