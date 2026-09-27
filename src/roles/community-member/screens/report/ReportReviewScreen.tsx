import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ClipboardListIcon,
  CloudOffIcon,
  HardDriveIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react-native';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  KeyValue,
  Modal,
  Notice,
  OfflineBanner,
  PhotoThumb,
  Screen,
  StickyFooter,
  WizardHeader,
  useToast,
} from '@shared/components';
import { useProfile } from '@shared/auth/AuthProvider';
import { useSync } from '@shared/sync/SyncProvider';
import { LocalStorageError } from '@shared/sync/LocalStorage';
import { colors } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { CommunityMember } from '../../models/CommunityMember';
import type { WizardStep } from '../../models/CommunityReport';
import { ReportValidationError, reportController } from '../../services/ReportController';
import { useReportDraft } from '../../context/ReportDraftProvider';
import { conflictVisual } from '../../components/conflictVisuals';
import { LocationSummary } from '../../components/LocationSummary';
import type { CommunityStackParamList, ReportSuccessParams } from '../../navigation/types';
import { STEP_ROUTE, WIZARD_CONTEXT, WIZARD_TOTAL } from './wizard';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ReportReview'>;

function ReviewSection({
  title,
  onEdit,
  issue,
  children,
}: {
  title: string;
  onEdit?: () => void;
  issue?: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card style={{ padding: 14, marginBottom: 12, borderColor: issue ? colors.crit : colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <AppText size={12} weight="semibold" color={colors.muted} style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </AppText>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel={`Edit ${title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <PencilIcon size={13} color={colors.forest500} />
            <AppText size={13} weight="semibold" color={colors.forest500}>
              Edit
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
      {issue ? <Notice tone="critical" icon={TriangleAlertIcon} message={issue} action="Fix now" onAction={onEdit} style={{ marginTop: 10 }} /> : null}
    </Card>
  );
}

/** UC-04 main flow steps 4–6: review, submit, validate and store (or keep offline). */
export function ReportReviewScreen({ navigation }: Props) {
  const profile = useProfile();
  const member = useMemo(() => CommunityMember.fromProfile(profile), [profile]);
  const { online } = useSync();
  const toast = useToast();
  const draft = useReportDraft();
  const report = draft.report;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const edit = (step: WizardStep) => navigation.push(STEP_ROUTE[step], { editing: true });

  const submit = async () => {
    if (!report) return;
    setError(null);
    setStorageError(null);
    const issues = reportController.validateReport(report);
    if (issues.length) {
      draft.setIssues(issues);
      toast.show('Some information is missing. Please complete it.', 'warn');
      edit(issues[0].step);
      return;
    }
    setSubmitting(true);
    const submitted = report.clone();
    try {
      const outcome = await member.submitCommunityReport(submitted);
      const params: ReportSuccessParams = {
        mode: outcome.kind,
        reportId: submitted.reportId,
        reportNo: outcome.kind === 'delivered' ? outcome.reportNo : null,
        typeName: submitted.conflictType?.getTypeName() ?? 'Conflict',
        reportedAt: submitted.reportedAt,
        photoCount: submitted.photos.length,
        flaggedDuplicate: outcome.kind === 'delivered' && outcome.flaggedDuplicate,
        storedReason: outcome.kind === 'stored' ? outcome.reason : undefined,
      };
      draft.finish();
      navigation.dispatch((state) =>
        CommonActions.reset({
          ...state,
          index: 1,
          routes: [state.routes[0], { key: `ReportSuccess-${submitted.reportId}`, name: 'ReportSuccess', params }],
        }),
      );
    } catch (e) {
      setSubmitting(false);
      if (e instanceof ReportValidationError) {
        draft.setIssues(e.issues);
        toast.show(e.message, 'warn');
        edit(e.issues[0].step);
      } else if (e instanceof LocalStorageError) {
        setStorageError(e.message);
      } else {
        setError(getErrorMessage(e));
      }
    }
  };

  if (!report) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <WizardHeader step={4} total={WIZARD_TOTAL} title="Review and submit" context={WIZARD_CONTEXT} />
        <EmptyState
          icon={ClipboardListIcon}
          title="No report in progress"
          message="Start a new conflict report to review it here."
          actionLabel="Start a report"
          onAction={() => navigation.replace('ReportType')}
        />
      </View>
    );
  }

  const type = report.conflictType;
  const Icon = conflictVisual(type?.typeId).icon;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={4} total={WIZARD_TOTAL} title="Review and submit" context={WIZARD_CONTEXT} />
      <OfflineBanner />
      <Screen>
        {!online ? (
          <Notice
            tone="warn"
            icon={CloudOffIcon}
            title="You are offline"
            message="The report will be saved on this device as Pending Synchronization and sent automatically when you are back online."
            style={{ marginBottom: 12 }}
          />
        ) : null}
        {error ? <Notice tone="critical" icon={TriangleAlertIcon} title="The report was not submitted" message={error} style={{ marginBottom: 12 }} /> : null}

        <ReviewSection title="Conflict type" onEdit={() => edit('type')} issue={draft.issueFor('type')}>
          {type ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={19} color={colors.forest500} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText size={15} weight="semibold">
                  {type.getTypeName()}
                </AppText>
                <AppText size={12} color={colors.muted}>
                  {conflictVisual(type.typeId).hint}
                </AppText>
              </View>
            </View>
          ) : (
            <AppText size={13} color={colors.muted}>
              Not selected
            </AppText>
          )}
        </ReviewSection>

        <ReviewSection title="Location" onEdit={() => edit('location')} issue={draft.issueFor('location')}>
          {report.location ? (
            <LocationSummary location={report.location} mapHeight={140} />
          ) : (
            <AppText size={13} color={colors.muted}>
              Not provided
            </AppText>
          )}
        </ReviewSection>

        <ReviewSection title="Description" onEdit={() => edit('details')} issue={draft.issueFor('details')}>
          <AppText size={14} lineHeight={21} color={report.description.trim() ? colors.ink : colors.muted}>
            {report.description.trim() || 'Not provided'}
          </AppText>
        </ReviewSection>

        <ReviewSection title={`Photos (${report.photos.length})`} onEdit={() => edit('details')}>
          {report.photos.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {report.photos.map((p, i) => (
                <PhotoThumb key={p.photoId} uri={p.photoPath} index={i} size={72} />
              ))}
            </View>
          ) : (
            <AppText size={13} color={colors.muted}>
              No photo attached (optional)
            </AppText>
          )}
        </ReviewSection>

        <ReviewSection title="Reported by">
          <KeyValue
            items={[
              { label: 'Name', value: member.name || '—' },
              { label: 'Village', value: member.village || '—' },
              { label: 'Contact', value: member.contactNumber || '—' },
              { label: 'Channel', value: 'App' },
            ]}
          />
        </ReviewSection>

        <AppText size={12} color={colors.muted} lineHeight={18}>
          After you submit, the report appears on the operations dashboard. A Community Liaison Officer reviews it and
          may send a ranger. You will be notified about updates.
        </AppText>
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={SendIcon} loading={submitting} onPress={submit}>
          {online ? 'Submit report' : 'Save report on this device'}
        </Button>
        <Button full variant="ghost" disabled={submitting} onPress={() => setConfirmDiscard(true)}>
          Discard report
        </Button>
      </StickyFooter>

      <Modal
        open={!!storageError}
        onClose={() => setStorageError(null)}
        icon={HardDriveIcon}
        tone="critical"
        title="Could not save on this device"
        description={`${storageError ?? ''} Your report has not been lost – it is still on this screen.`}
        actions={
          <>
            <Button full onPress={submit} loading={submitting}>
              Retry
            </Button>
            <Button full variant="ghost" onPress={() => setStorageError(null)}>
              Cancel
            </Button>
          </>
        }
      />
      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        icon={Trash2Icon}
        tone="warn"
        title="Discard this report?"
        description="The information and photos you entered will be deleted from this device."
        actions={
          <>
            <Button
              full
              variant="danger"
              onPress={() => {
                setConfirmDiscard(false);
                draft.discard();
                navigation.popToTop();
              }}
            >
              Discard
            </Button>
            <Button full variant="ghost" onPress={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
          </>
        }
      />
    </View>
  );
}
