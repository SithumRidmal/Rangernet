import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, Card, Field, Input, Screen, StickyFooter, WizardHeader } from '@shared/components';
import { colors } from '@shared/theme';
import { INCIDENT_DESCRIPTION_MAX } from '../../models/Incident';
import { incidentTypeVisual } from '../../components/incidentTypeIcon';
import { useIncidentDraft } from '../../incident/IncidentDraftContext';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

/** UC-01 step 7: the ranger enters a short description of the incident. */
export function IncidentDescriptionScreen({ navigation }: RangerScreenProps<'IncidentDescription'>) {
  const { incident, update } = useIncidentDraft();
  const [text, setText] = useState(incident?.description ?? '');
  const [touched, setTouched] = useState(false);
  if (!incident) return null;
  const { icon: Icon } = incidentTypeVisual(incident.type.getTypeName());
  const empty = text.trim().length === 0;

  const onContinue = () => {
    setTouched(true);
    update((i) => i.setDescription(text));
    if (!empty) navigation.navigate('IncidentReview');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={4} total={5} title="Describe the incident" context={incident.type.getTypeName()} />
      <Screen>
        <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Icon size={18} color={colors.forest500} />
          <AppText size={14}>{incident.type.getTypeName()}</AppText>
        </Card>
        <Field
          label="Description"
          required
          error={touched && empty ? 'Please enter a short description of what you found.' : null}
          hint={`${text.length}/${INCIDENT_DESCRIPTION_MAX} characters`}
        >
          <Input
            multiline
            value={text}
            onChangeText={(v) => setText(v.slice(0, INCIDENT_DESCRIPTION_MAX))}
            onBlur={() => update((i) => i.setDescription(text))}
            placeholder="What did you find? Include landmarks, number of items, signs of recent activity…"
            invalid={touched && empty}
            autoFocus={!incident.description}
          />
        </Field>
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={onContinue}>
          Review incident
        </Button>
      </StickyFooter>
    </View>
  );
}
