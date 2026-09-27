import React, { useState } from 'react';
import { View } from 'react-native';
import { HouseIcon, PhoneIcon, UserIcon } from 'lucide-react-native';
import { colors } from '../theme';
import { AppText } from '../components/ui/AppText';
import { AppBar, Screen, StickyFooter } from '../components/ui/chrome';
import { Button, Card, Field, Input, KeyValue, Notice } from '../components/ui/primitives';
import { Avatar } from '../components/cards';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../auth/AuthProvider';
import { useLookups } from '../lookups/useLookups';
import { supabase } from '../lib/supabase';
import { getErrorMessage, unwrap } from '../utils/errors';
import { ROLE_LABELS } from '../types';

export function ProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const { parkName } = useLookups();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [contact, setContact] = useState(profile?.contact_number ?? '');
  const [village, setVillage] = useState(profile?.village ?? '');
  const [area, setArea] = useState(profile?.assigned_area ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  const save = async () => {
    setError(null);
    if (!fullName.trim()) return setError('Name cannot be empty.');
    setBusy(true);
    try {
      unwrap(
        await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            contact_number: contact.trim() || null,
            village: profile.role === 'community_member' ? village.trim() || null : profile.village,
            assigned_area: profile.role === 'community_liaison_officer' ? area.trim() || null : profile.assigned_area,
          })
          .eq('id', profile.id)
          .select()
          .single(),
      );
      await refreshProfile();
      toast.show('Profile updated', 'ok');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Profile" />
      <Screen>
        <Card style={{ padding: 16, alignItems: 'center' }}>
          <Avatar name={profile.full_name} size={64} />
          <AppText size={17} weight="semibold" style={{ marginTop: 10 }}>
            {profile.full_name}
          </AppText>
          <AppText size={12} color={colors.muted}>
            {ROLE_LABELS[profile.role]}
          </AppText>
        </Card>
        <Card style={{ padding: 16, marginTop: 12 }}>
          <KeyValue
            items={[
              { label: 'E-mail', value: profile.email ?? '—' },
              { label: 'Employee ID', value: profile.employee_id ?? '—' },
              { label: 'Park', value: profile.park_id ? parkName(profile.park_id) : 'All parks' },
              { label: 'Status', value: profile.is_active ? 'Active' : 'Inactive' },
            ]}
          />
        </Card>
        <View style={{ marginTop: 20, gap: 16 }}>
          <Field label="Full name" required>
            <Input icon={UserIcon} value={fullName} onChangeText={setFullName} />
          </Field>
          <Field label="Contact number">
            <Input icon={PhoneIcon} value={contact} onChangeText={setContact} keyboardType="phone-pad" />
          </Field>
          {profile.role === 'community_member' ? (
            <Field label="Village">
              <Input icon={HouseIcon} value={village} onChangeText={setVillage} />
            </Field>
          ) : null}
          {profile.role === 'community_liaison_officer' ? (
            <Field label="Assigned area">
              <Input value={area} onChangeText={setArea} />
            </Field>
          ) : null}
          {error ? <Notice tone="critical" message={error} /> : null}
        </View>
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={save} loading={busy}>
          Save changes
        </Button>
      </StickyFooter>
    </View>
  );
}
