import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Button, LoadingBlock, Screen, StickyFooter, WizardHeader } from '@shared/components';
import { colors, radius } from '@shared/theme';
import { IncidentType } from '../../models/IncidentType';
import { incidentTypeVisual } from '../../components/incidentTypeIcon';
import { useIncidentDraft } from '../../incident/IncidentDraftContext';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

/** UC-01 steps 1-3: the system displays the available incident types and the ranger selects one. */
export function IncidentTypeScreen({ navigation }: RangerScreenProps<'IncidentType'>) {
  const { incident, begin, reset } = useIncidentDraft();
  const [types, setTypes] = useState<IncidentType[] | null>(null);
  const [selected, setSelected] = useState<number | null>(incident?.type.typeId ?? null);

  useEffect(() => {
    let alive = true;
    IncidentType.getAvailableTypes().then((t) => alive && setTypes(t));
    return () => {
      alive = false;
    };
  }, []);

  // Leaving the wizard (header back, hardware back or swipe) discards the unfinished draft and its photos.
  useEffect(() => navigation.addListener('beforeRemove', () => reset()), [navigation, reset]);

  const onContinue = () => {
    const type = types?.find((t) => t.typeId === selected);
    if (!type) return;
    const hadPhotos = (incident?.photos.length ?? 0) > 0;
    begin(type);
    navigation.navigate(hadPhotos ? 'IncidentReview' : 'IncidentPhoto');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={1} total={5} title="What are you reporting?" context="Report incident" />
      <Screen>
        {!types ? (
          <LoadingBlock label="Loading incident types…" />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {types.map((t) => {
              const active = selected === t.typeId;
              const { icon: Icon, hint } = incidentTypeVisual(t.getTypeName());
              return (
                <Pressable
                  key={t.typeId}
                  onPress={() => setSelected(t.typeId)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    width: '48.5%',
                    minHeight: 124,
                    justifyContent: 'space-between',
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: active ? colors.forest500 : colors.line,
                    backgroundColor: active ? colors.forest50 : colors.white,
                    padding: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? colors.forest500 : colors.forest100,
                    }}
                  >
                    <Icon size={18} color={active ? colors.white : colors.forest500} />
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <AppText size={14} weight="semibold">
                      {t.getTypeName()}
                    </AppText>
                    <AppText size={11} color={colors.muted} lineHeight={15} style={{ marginTop: 2 }}>
                      {hint}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <AppText size={12} color={colors.muted} style={{ marginTop: 16 }} lineHeight={18}>
          After you continue, the camera opens so you can photograph the incident.
        </AppText>
      </Screen>
      <StickyFooter>
        <Button full size="lg" disabled={selected === null} onPress={onContinue}>
          Continue
        </Button>
      </StickyFooter>
    </View>
  );
}
