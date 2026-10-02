import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CloudOffIcon, FilePenLineIcon, MessageSquareTextIcon, SmartphoneIcon, Trash2Icon } from 'lucide-react-native';
import {
  ActionTile,
  AppBar,
  AppText,
  BellButton,
  Button,
  Card,
  Divider,
  ListRow,
  Modal,
  Notice,
  OfflineBanner,
  Screen,
  SectionHeader,
} from '@shared/components';
import { env } from '@shared/config/env';
import { useLookups } from '@shared/lookups/useLookups';
import { colors } from '@shared/theme';
import { ConflictType } from '../models/ConflictType';
import { useReportDraft } from '../context/ReportDraftProvider';
import { conflictVisual } from '../components/conflictVisuals';
import { isSmsReportingConfigured } from '../services/SmsReportService';
import { useCommunityNavigation } from '../navigation/types';

/** "Report" tab: choose the reporting channel (app or SMS) and see what can be reported. */
export function ReportHubScreen() {
  const navigation = useCommunityNavigation();
  const draft = useReportDraft();
  const { conflictTypes } = useLookups();
  const types = useMemo(() => conflictTypes.map((t) => ConflictType.fromLookup(t)), [conflictTypes]);
  const smsEnabled = isSmsReportingConfigured();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const startWith = (type: ConflictType) => {
    draft.update((r) => {
      r.conflictType = type;
    });
    draft.clearIssue('type');
    navigation.navigate('ReportType');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Report" subtitle="Human-wildlife conflict" right={<BellButton />} hideBack />
      <OfflineBanner />
      <Screen>
        {draft.hasProgress ? (
          <Card style={{ padding: 14, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.warnBg, alignItems: 'center', justifyContent: 'center' }}>
                <FilePenLineIcon size={18} color={colors.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText size={14} weight="semibold">
                  Unfinished report
                </AppText>
                <AppText size={12} color={colors.muted} numberOfLines={1}>
                  {draft.report?.conflictType?.getTypeName() ?? 'Type not selected'}
                  {draft.report?.photos.length ? ` · ${draft.report.photos.length} photo(s)` : ''}
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button variant="outline" size="sm" icon={Trash2Icon} onPress={() => setConfirmDiscard(true)} style={{ flex: 1 }}>
                Discard
              </Button>
              <Button size="sm" onPress={() => navigation.navigate('ReportType')} style={{ flex: 1 }}>
                Continue
              </Button>
            </View>
          </Card>
        ) : null}

        <AppText size={13} color={colors.muted} lineHeight={19} style={{ marginBottom: 14 }}>
          Tell the park team when wild animals threaten people, crops or homes. A Community Liaison Officer reviews
          every report and a ranger is sent when the risk is high.
        </AppText>

        <View style={{ flexDirection: 'row' }}>
          <ActionTile
            icon={SmartphoneIcon}
            label={draft.hasProgress ? 'Continue in the app' : 'Report in the app'}
            sub="4 quick steps · works without signal"
            tone="solid"
            onPress={() => navigation.navigate('ReportType')}
          />
        </View>
        {smsEnabled ? (
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            <ActionTile
              icon={MessageSquareTextIcon}
              label="Report by SMS"
              sub={`Send a text message to ${env.smsReportNumber}`}
              onPress={() => navigation.navigate('SmsReport')}
            />
          </View>
        ) : null}

        <SectionHeader title="What you can report" style={{ marginTop: 22 }} />
        <Card>
          {types.map((t, i) => (
            <View key={t.typeId}>
              {i > 0 ? <Divider /> : null}
              <ListRow icon={conflictVisual(t.typeId).icon} title={t.getTypeName()} subtitle={conflictVisual(t.typeId).hint} onPress={() => startWith(t)} />
            </View>
          ))}
        </Card>

        <Notice
          tone="info"
          icon={CloudOffIcon}
          message="No signal? Your report is saved on this device and sent automatically when you are back online."
          style={{ marginTop: 16 }}
        />
      </Screen>

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        icon={Trash2Icon}
        tone="warn"
        title="Discard unfinished report?"
        description="The information and photos you entered will be deleted from this device."
        actions={
          <>
            <Button
              full
              variant="danger"
              onPress={() => {
                draft.discard();
                setConfirmDiscard(false);
              }}
            >
              Discard
            </Button>
            <Button full variant="ghost" onPress={() => setConfirmDiscard(false)}>
              Keep it
            </Button>
          </>
        }
      />
    </View>
  );
}
