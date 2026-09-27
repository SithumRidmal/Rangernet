import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarClockIcon } from 'lucide-react-native';
import { AppText, BottomSheet, Button } from '@shared/components';
import { colors, radius } from '@shared/theme';
import { formatDateTime } from '@shared/utils/format';

export function DateTimeField({
  value,
  onChange,
  invalid,
  minimumDate,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  invalid?: boolean;
  minimumDate?: Date;
}) {
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? new Date());

  const open = () => {
    const base = value ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        minimumDate,
        onValueChange: (_e, date) => {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onValueChange: (_t, time) => {
              const combined = new Date(date);
              combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(combined);
            },
          });
        },
      });
      return;
    }
    setDraft(base);
    setSheet(true);
  };

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Choose scheduled date and time"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          minHeight: 48,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: invalid ? colors.crit : pressed ? colors.forest400 : colors.line,
          backgroundColor: colors.white,
          paddingHorizontal: 14,
        })}
      >
        <CalendarClockIcon size={17} color={colors.muted} />
        <AppText size={14} color={value ? colors.ink : colors.muted} style={{ flex: 1 }}>
          {value ? formatDateTime(value) : 'Select date and time'}
        </AppText>
        <AppText size={13} weight="semibold" color={colors.forest500}>
          Change
        </AppText>
      </Pressable>
      {Platform.OS !== 'android' ? (
        <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Scheduled start">
          <View style={{ alignItems: 'center' }}>
            <DateTimePicker
              value={draft}
              mode="datetime"
              display="inline"
              minimumDate={minimumDate}
              accentColor={colors.forest500}
              onValueChange={(_e, d) => setDraft(d)}
            />
          </View>
          <View style={{ paddingVertical: 12 }}>
            <Button
              full
              onPress={() => {
                onChange(draft);
                setSheet(false);
              }}
            >
              Set {formatDateTime(draft)}
            </Button>
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}
