import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraIcon, CameraOffIcon, ImageIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react-native';
import {
  AppText,
  Button,
  Field,
  Input,
  Notice,
  OfflineBanner,
  PhotoThumb,
  Screen,
  SectionHeader,
  StickyFooter,
  WizardHeader,
} from '@shared/components';
import { CameraUnavailableError, InvalidPhotoError } from '@shared/media/photos';
import { colors, radius } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { MAX_DESCRIPTION, MAX_PHOTOS } from '../../models/CommunityReport';
import { ReportPhoto, type PhotoSource } from '../../models/ReportPhoto';
import { useReportDraft } from '../../context/ReportDraftProvider';
import type { CommunityStackParamList } from '../../navigation/types';
import { WIZARD_CONTEXT, WIZARD_TOTAL } from './wizard';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ReportDetails'>;
type PhotoProblem = { kind: 'invalid' | 'camera'; source: PhotoSource; message: string };

function AddPhotoTile({ icon: Icon, label, onPress, disabled }: { icon: LucideIcon; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        width: 80,
        height: 80,
        borderRadius: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.forest300,
        backgroundColor: pressed ? colors.forest50 : colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Icon size={20} color={colors.forest500} />
      <AppText size={11} weight="medium" color={colors.forest600}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** UC-04 main flow step 3: description (required) and an optional photo. */
export function ReportDetailsScreen({ navigation, route }: Props) {
  const editing = !!route.params?.editing;
  const draft = useReportDraft();
  const { report, update } = draft;
  const description = report?.description ?? '';
  const photos = report?.photos ?? [];
  const issue = draft.issueFor('details');
  const [busy, setBusy] = useState<PhotoSource | null>(null);
  const [problem, setProblem] = useState<PhotoProblem | null>(null);

  const addPhoto = async (source: PhotoSource) => {
    setBusy(source);
    setProblem(null);
    try {
      const photo = await ReportPhoto.addPhoto(source);
      if (photo) {
        update((r) => {
          r.photos = [...r.photos, photo];
        });
      }
    } catch (e) {
      if (e instanceof InvalidPhotoError) setProblem({ kind: 'invalid', source, message: e.message });
      else if (e instanceof CameraUnavailableError) setProblem({ kind: 'camera', source, message: e.message });
      else setProblem({ kind: 'camera', source, message: getErrorMessage(e, 'The photo could not be added.') });
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = (photo: ReportPhoto) => {
    update((r) => {
      r.photos = r.photos.filter((p) => p.photoId !== photo.photoId);
    });
    photo.removePhoto();
  };

  const onContinue = () => {
    const found = report?.validateReport().find((i) => i.step === 'details');
    if (found) {
      draft.raise(found);
      return;
    }
    if (editing) navigation.goBack();
    else navigation.navigate('ReportReview');
  };

  const canAdd = photos.length < MAX_PHOTOS;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={3} total={WIZARD_TOTAL} title="What did you see?" context={WIZARD_CONTEXT} />
      <OfflineBanner />
      <Screen>
        <Field
          label="Description"
          required
          error={issue}
          hint={`${description.length}/${MAX_DESCRIPTION} · What animals, how many, what damage, are they still there?`}
        >
          <Input
            multiline
            value={description}
            maxLength={MAX_DESCRIPTION}
            invalid={!!issue}
            placeholder="e.g. Three elephants entered the paddy fields near the tank around 7 pm and are still there."
            onChangeText={(text) => {
              update((r) => {
                r.description = text;
              });
              if (issue && text.trim()) draft.clearIssue('details');
            }}
          />
        </Field>

        <SectionHeader title={`Photo (optional)${photos.length ? ` · ${photos.length}` : ''}`} style={{ marginTop: 22 }} />
        <AppText size={13} color={colors.muted} lineHeight={19}>
          A photo helps the officer understand the situation. Only take one if it is safe to do so.
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          {photos.map((p, i) => (
            <PhotoThumb key={p.photoId} uri={p.photoPath} index={i} onRemove={() => removePhoto(p)} />
          ))}
          {canAdd ? (
            <>
              <AddPhotoTile icon={CameraIcon} label="Take photo" onPress={() => addPhoto('camera')} disabled={!!busy} />
              <AddPhotoTile icon={ImageIcon} label="Gallery" onPress={() => addPhoto('gallery')} disabled={!!busy} />
            </>
          ) : null}
          {busy ? (
            <View style={{ height: 80, justifyContent: 'center', paddingHorizontal: 6 }}>
              <ActivityIndicator color={colors.forest500} />
            </View>
          ) : null}
        </View>
        {!canAdd ? (
          <AppText size={12} color={colors.muted} style={{ marginTop: 8 }}>
            You can attach up to {MAX_PHOTOS} photos.
          </AppText>
        ) : null}

        {problem?.kind === 'invalid' ? (
          <Notice
            tone="critical"
            icon={TriangleAlertIcon}
            title="Photo rejected"
            message={`${problem.message} Choose another photo, or continue without one – the photo is optional.`}
            action={problem.source === 'gallery' ? 'Choose another photo' : 'Take another photo'}
            onAction={() => addPhoto(problem.source)}
            style={{ marginTop: 14, borderRadius: radius.md }}
          />
        ) : null}
        {problem?.kind === 'camera' ? (
          <Notice
            tone="warn"
            icon={CameraOffIcon}
            title={problem.source === 'camera' ? 'Camera unavailable' : 'Gallery unavailable'}
            message={`${problem.message} You can try again, use the other option, or continue without a photo.`}
            action="Try again"
            onAction={() => addPhoto(problem.source)}
            style={{ marginTop: 14 }}
          />
        ) : null}
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={onContinue}>
          {editing ? 'Save and return to review' : photos.length ? 'Continue' : 'Continue without photo'}
        </Button>
      </StickyFooter>
    </View>
  );
}
