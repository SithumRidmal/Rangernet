import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarIcon } from 'lucide-react-native';
import { AppText, BottomSheet, Button } from '@shared/components';
import { colors, radius } from '@shared/theme';
import { formatDate, toIsoDate } from '@shared/utils/format';
import { parseLocalDate } from '../services/dates';

/** Date input: native dialog on Android, inline calendar in a bottom sheet on iOS. */
export function DateField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  invalid?: boolean;
}) {
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<Date>(() => parseLocalDate(value) ?? new Date());

  const open = () => {
    const current = parseLocalDate(value) ?? new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        title: label,
        onValueChange: (_e, date) => onChange(toIsoDate(date)),
      });
    } else {
      setDraft(current);
      setSheet(true);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <AppText size={12} color={colors.muted} style={{ marginBottom: 4 }}>
        {label}
      </AppText>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDate(parseLocalDate(value))}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          height: 46,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: invalid ? colors.crit : pressed ? colors.forest400 : colors.line,
          backgroundColor: colors.white,
          paddingHorizontal: 12,
        })}
      >
        <CalendarIcon size={16} color={colors.muted} />
        <AppText size={14} style={{ flex: 1 }} numberOfLines={1}>
          {formatDate(parseLocalDate(value))}
        </AppText>
      </Pressable>
      {Platform.OS !== 'android' ? (
        <BottomSheet open={sheet} onClose={() => setSheet(false)} title={label}>
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            accentColor={colors.forest500}
            themeVariant="light"
            onValueChange={(_e, date) => setDraft(date)}
          />
          <View style={{ paddingVertical: 12 }}>
            <Button
              full
              size="lg"
              onPress={() => {
                onChange(toIsoDate(draft));
                setSheet(false);
              }}
            >
              Done
            </Button>
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}
