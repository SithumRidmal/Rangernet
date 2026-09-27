import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, BottomSheet, Button, Field, Input, RadioRow } from '@shared/components';
import { colors } from '@shared/theme';
import type { ResponseAssignment } from '../models/ResponseAssignment';
import type { ResponseStatus } from '../services/rows';

const STATUS_HINT: Record<ResponseStatus, string> = {
  Assigned: 'Ranger notified',
  Acknowledged: 'The ranger confirmed the high-risk alert',
  Responding: 'The ranger is in the field handling the conflict',
  Resolved: 'The conflict has been handled – closes the report',
};

export function ResponseStatusSheet({
  open,
  assignment,
  busy,
  disabled,
  onClose,
  onSubmit,
}: {
  open: boolean;
  assignment: ResponseAssignment;
  busy: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (status: ResponseStatus, notes: string) => void;
}) {
  const options = assignment.nextStatuses();
  const [status, setStatus] = useState<ResponseStatus | null>(options[0] ?? null);
  const [notes, setNotes] = useState('');
  const [openedFor, setOpenedFor] = useState<ResponseAssignment | null>(open ? assignment : null);

  const target = open ? assignment : null;
  if (target !== openedFor) {
    setOpenedFor(target);
    if (target) {
      setStatus(target.nextStatuses()[0] ?? null);
      setNotes('');
    }
  }

  const notesRequired = status === 'Resolved';
  const invalid = !status || (notesRequired && !notes.trim());

  return (
    <BottomSheet open={open} onClose={onClose} title="Update response status">
      <AppText size={13} color={colors.muted} style={{ marginBottom: 12 }}>
        Currently {assignment.responseStatus} · {assignment.rangerName}
      </AppText>
      <View style={{ gap: 10 }}>
        {options.map((s) => (
          <RadioRow key={s} label={s} description={STATUS_HINT[s]} selected={status === s} onSelect={() => setStatus(s)} />
        ))}
      </View>
      <Field
        label={notesRequired ? 'Outcome' : 'Response notes'}
        required={notesRequired}
        hint={notesRequired ? 'Describe how the conflict was resolved' : 'Visible to the assigned ranger'}
        style={{ marginTop: 14 }}
      >
        <Input value={notes} onChangeText={setNotes} placeholder="Add notes from the field" multiline maxLength={800} />
      </Field>
      <View style={{ marginTop: 16, paddingBottom: 8 }}>
        <Button full size="lg" loading={busy} disabled={invalid || disabled} onPress={() => status && onSubmit(status, notes)}>
          Update status
        </Button>
      </View>
    </BottomSheet>
  );
}
