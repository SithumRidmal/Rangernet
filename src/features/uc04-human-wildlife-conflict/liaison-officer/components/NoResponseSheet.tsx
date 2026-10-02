import React, { useState } from 'react';
import { View } from 'react-native';
import { CheckCircle2Icon, CircleSlashIcon } from 'lucide-react-native';
import { AppText, BottomSheet, Button, Field, Input, RadioRow } from '@shared/components';
import { colors } from '@shared/theme';
import type { AssessedStatus } from '../models/CommunityReport';

export function NoResponseSheet({
  open,
  busy,
  disabled,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (status: AssessedStatus, note: string) => void;
}) {
  const [status, setStatus] = useState<AssessedStatus>('Resolved');
  const [note, setNote] = useState('');
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStatus('Resolved');
      setNote('');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="No field response required">
      <AppText size={13} color={colors.muted} style={{ marginBottom: 12 }} lineHeight={19}>
        Store the assessed status of this report. The community member is notified.
      </AppText>
      <View style={{ gap: 10 }}>
        <RadioRow
          icon={CheckCircle2Icon}
          label="Resolved"
          description="The conflict was handled without sending a ranger"
          selected={status === 'Resolved'}
          onSelect={() => setStatus('Resolved')}
        />
        <RadioRow
          icon={CircleSlashIcon}
          label="Closed"
          description="No action needed (e.g. animal already left the area)"
          selected={status === 'Closed'}
          onSelect={() => setStatus('Closed')}
        />
      </View>
      <Field label="Note to reporter" hint="Stored as the assessment note" style={{ marginTop: 14 }}>
        <Input value={note} onChangeText={setNote} placeholder="Explain the outcome for the community member" multiline maxLength={500} />
      </Field>
      <View style={{ marginTop: 16, paddingBottom: 8 }}>
        <Button full size="lg" loading={busy} disabled={disabled} onPress={() => onSubmit(status, note)}>
          Store status
        </Button>
      </View>
    </BottomSheet>
  );
}
