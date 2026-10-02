import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRightIcon, CopyIcon } from 'lucide-react-native';
import { AppText, Button, Card, StatusBadge } from '@shared/components';
import { colors } from '@shared/theme';
import { formatDateTime } from '@shared/utils/format';
import type { CommunityReport } from '../models/CommunityReport';

export function DuplicateBanner({
  original,
  busy,
  disabled,
  onOpenOriginal,
  onConfirm,
  onClear,
}: {
  original: CommunityReport | null;
  busy: 'confirm' | 'clear' | null;
  disabled?: boolean;
  onOpenOriginal: () => void;
  onConfirm: () => void;
  onClear: () => void;
}) {
  return (
    <Card style={{ borderColor: 'rgba(232,162,58,0.45)', backgroundColor: colors.warnBg, padding: 14 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <CopyIcon size={16} color={colors.warn} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText size={14} weight="semibold" color={colors.warnText}>
            Possible duplicate report
          </AppText>
          <AppText size={12} color={colors.warnText} lineHeight={17} style={{ marginTop: 2 }}>
            A similar conflict was reported at a nearby location recently. Review it to avoid sending a duplicate response.
          </AppText>
        </View>
      </View>

      {original ? (
        <Pressable
          onPress={onOpenOriginal}
          style={({ pressed }) => ({
            marginTop: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: pressed ? colors.forest50 : colors.white,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          })}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText size={12} weight="semibold" color={colors.forest600}>
              Original · {original.code}
            </AppText>
            <AppText size={14} weight="medium" numberOfLines={1} style={{ marginTop: 2 }}>
              {original.conflictType.getTypeName()}
            </AppText>
            <AppText size={12} color={colors.muted} numberOfLines={2} style={{ marginTop: 2 }}>
              {formatDateTime(original.reportedAt)} · {original.description}
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <StatusBadge status={original.status} size="sm" />
              {original.isHighRisk ? <StatusBadge status="High Risk" size="sm" /> : null}
              {original.assignment ? <StatusBadge status={original.assignment.responseStatus} size="sm" /> : null}
            </View>
          </View>
          <ChevronRightIcon size={17} color={colors.muted} />
        </Pressable>
      ) : (
        <AppText size={12} color={colors.warnText} style={{ marginTop: 10 }}>
          The original report is no longer available.
        </AppText>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button variant="outline" size="sm" style={{ flex: 1 }} loading={busy === 'clear'} disabled={disabled || busy !== null} onPress={onClear}>
          Not a duplicate
        </Button>
        <Button variant="warning" size="sm" style={{ flex: 1 }} loading={busy === 'confirm'} disabled={disabled || busy !== null} onPress={onConfirm}>
          Confirm duplicate
        </Button>
      </View>
    </Card>
  );
}
