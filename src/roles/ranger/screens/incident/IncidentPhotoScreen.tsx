import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CameraIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react-native';
import { AppText, Button, Card, Notice, PhotoThumb, Screen, StickyFooter, WizardHeader, useToast } from '@shared/components';
import { colors, radius } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { IncidentPhoto } from '../../models/IncidentPhoto';
import { useIncidentDraft } from '../../incident/IncidentDraftContext';
import type { RangerScreenProps } from '../../navigation/types';

const MAX_PHOTOS = 5;

/** UC-01 steps 4-5: the system activates the camera and the ranger captures a photograph (5a: retake). */
export function IncidentPhotoScreen({ navigation }: RangerScreenProps<'IncidentPhoto'>) {
  const { incident, update } = useIncidentDraft();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoOpened = useRef(false);

  const capture = useCallback(
    async (replace?: IncidentPhoto) => {
      setBusy(true);
      setError(null);
      try {
        const next = replace ? await replace.retakePhoto() : await IncidentPhoto.capturePhoto();
        if (next) {
          update((i) => (replace ? i.replacePhoto(replace, next) : i.addPhoto(next)));
          if (replace) toast.show('Photo retaken', 'ok');
        }
      } catch (e) {
        setError(getErrorMessage(e, 'The camera could not be opened.'));
      } finally {
        setBusy(false);
      }
    },
    [toast, update],
  );

  useEffect(() => {
    if (!autoOpened.current && incident && incident.photos.length === 0) {
      autoOpened.current = true;
      void capture();
    }
  }, [capture, incident]);

  if (!incident) return null;
  const photos = incident.photos;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={2} total={5} title="Photograph the incident" context={incident.type.getTypeName()} />
      <Screen>
        <AppText size={13} color={colors.muted} lineHeight={19}>
          Take a clear photograph of the evidence. If a photo is blurred or does not show the incident, retake it
          before continuing.
        </AppText>

        {error ? (
          <Notice
            tone="critical"
            icon={TriangleAlertIcon}
            title="Camera unavailable"
            message={error}
            action="Try again"
            onAction={() => void capture()}
            style={{ marginTop: 14 }}
          />
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          {photos.map((p, i) => (
            <View key={p.photoId} style={{ width: '31%' }}>
              <PhotoThumb uri={p.photoPath} index={i} size={104} onRemove={() => update((d) => d.removePhoto(p))} />
              <Pressable
                onPress={() => void capture(p)}
                disabled={busy}
                hitSlop={4}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
              >
                <RefreshCwIcon size={12} color={colors.forest500} />
                <AppText size={12} weight="semibold" color={colors.forest500}>
                  Retake
                </AppText>
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable
              onPress={() => void capture()}
              disabled={busy}
              style={{
                width: '31%',
                height: 104,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.forest300,
                backgroundColor: colors.white,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <CameraIcon size={22} color={colors.forest500} />
              <AppText size={11} weight="medium" color={colors.forest500}>
                {photos.length === 0 ? 'Open camera' : 'Add photo'}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <Card style={{ padding: 14, marginTop: 16 }}>
          <AppText size={13} weight="medium">
            {photos.length === 0 ? 'No photograph yet' : `${photos.length} photo${photos.length === 1 ? '' : 's'} captured`}
          </AppText>
          <AppText size={12} color={colors.muted} style={{ marginTop: 4 }} lineHeight={17}>
            Photos are kept securely on this device and uploaded with the incident, even if you are offline now.
          </AppText>
        </Card>
      </Screen>
      <StickyFooter>
        <Button full size="lg" disabled={photos.length === 0 || busy} loading={busy} onPress={() => navigation.navigate('IncidentLocation')}>
          Continue
        </Button>
      </StickyFooter>
    </View>
  );
}
