import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InfoIcon, TriangleAlertIcon } from 'lucide-react-native';
import { AppText, Button, Notice, OfflineBanner, Screen, StickyFooter, WizardHeader } from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { colors } from '@shared/theme';
import { ConflictType } from '../../models/ConflictType';
import { useReportDraft } from '../../context/ReportDraftProvider';
import { ConflictTypeGrid } from '../../components/ConflictTypeGrid';
import type { CommunityStackParamList } from '../../navigation/types';
import { WIZARD_CONTEXT, WIZARD_TOTAL } from './wizard';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ReportType'>;

/** UC-04 main flow step 1: the member selects a conflict type. */
export function ReportTypeScreen({ navigation, route }: Props) {
  const editing = !!route.params?.editing;
  const { conflictTypes } = useLookups();
  const types = useMemo(() => conflictTypes.map((t) => ConflictType.fromLookup(t)), [conflictTypes]);
  const draft = useReportDraft();
  const { report, update } = draft;
  const selectedId = report?.conflictType?.typeId ?? null;
  const issue = draft.issueFor('type');

  useEffect(() => {
    if (!report) update(() => undefined);
  }, [report, update]);

  const onContinue = () => {
    if (!selectedId) {
      draft.raise({ step: 'type', message: 'Please select a conflict type.' });
      return;
    }
    if (editing) navigation.goBack();
    else navigation.navigate('ReportLocation');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={1} total={WIZARD_TOTAL} title="What is happening?" context={WIZARD_CONTEXT} />
      <OfflineBanner />
      <Screen>
        <AppText size={13} color={colors.muted} lineHeight={19} style={{ marginBottom: 14 }}>
          Choose the type of human-wildlife conflict you want to report.
        </AppText>
        <ConflictTypeGrid
          types={types}
          selectedId={selectedId}
          onSelect={(t) => {
            update((r) => {
              r.conflictType = t;
            });
            draft.clearIssue('type');
          }}
        />
        {issue ? <Notice tone="critical" icon={TriangleAlertIcon} message={issue} style={{ marginTop: 14 }} /> : null}
        <Notice
          tone="info"
          icon={InfoIcon}
          message="If anyone is in immediate danger, move to a safe place first. You can report once you are safe."
          style={{ marginTop: 14 }}
        />
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={onContinue}>
          {editing ? 'Save and return to review' : 'Continue'}
        </Button>
      </StickyFooter>
    </View>
  );
}
