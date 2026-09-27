import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, BottomSheet, Button, Card, Field, Input, RadioRow, Toggle } from '@shared/components';
import { colors } from '@shared/theme';
import { SEVERITIES, type Severity } from '../services/rows';
import type { CommunityReport } from '../models/CommunityReport';

const SEVERITY_HINT: Record<Severity, string> = {
  Low: 'Sighting only – no damage or immediate threat',
  Medium: 'Some damage to crops or property, animal moving away',
  High: 'Animal at farmland or settlement, damage ongoing',
  Critical: 'Immediate danger to people or livestock',
};

const isHighSeverity = (s: Severity) => s === 'High' || s === 'Critical';

export function SeveritySheet({
  open,
  report,
  busy,
  disabled,
  onClose,
  onSubmit,
}: {
  open: boolean;
  report: CommunityReport;
  busy: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSubmit: (severity: Severity, isHighRisk: boolean, note: string) => void;
}) {
  const [severity, setSeverity] = useState<Severity | null>(report.severity);
  const [highRisk, setHighRisk] = useState(report.isHighRisk);
  const [note, setNote] = useState(report.assessmentNote ?? '');
  const [openedFor, setOpenedFor] = useState<CommunityReport | null>(open ? report : null);

  const target = open ? report : null;
  if (target !== openedFor) {
    setOpenedFor(target);
    if (target) {
      setSeverity(target.severity);
      setHighRisk(target.isHighRisk);
      setNote(target.assessmentNote ?? '');
    }
  }

  const pick = (s: Severity) => {
    setSeverity(s);
    setHighRisk(isHighSeverity(s));
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={report.isAssessed ? 'Reassess severity' : 'Assess severity'}>
      <AppText size={13} color={colors.muted} style={{ marginBottom: 12 }}>
        {report.code} · {report.conflictType.getTypeName()}
        {report.severity ? ` · currently ${report.severity}` : ''}
      </AppText>
      <View style={{ gap: 10 }}>
        {SEVERITIES.map((s) => (
          <RadioRow key={s} label={s} description={SEVERITY_HINT[s]} selected={severity === s} onSelect={() => pick(s)} />
        ))}
      </View>
      <Card style={{ marginTop: 14 }}>
        <Toggle
          checked={highRisk}
          onChange={setHighRisk}
          label="Mark as high risk"
          description="High-risk conflicts need a coordinated ranger response"
        />
      </Card>
      <Field label="Assessment note" hint="Stored with the report assessment" style={{ marginTop: 14 }}>
        <Input value={note} onChangeText={setNote} placeholder="What did you base the assessment on?" multiline maxLength={500} />
      </Field>
      <View style={{ marginTop: 16, paddingBottom: 8 }}>
        <Button full size="lg" loading={busy} disabled={!severity || disabled} onPress={() => severity && onSubmit(severity, highRisk, note)}>
          Save assessment
        </Button>
      </View>
    </BottomSheet>
  );
}
