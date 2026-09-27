import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CrosshairIcon, MapPinnedIcon, MapPinIcon, SatelliteDishIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppText,
  Button,
  Card,
  LocationPicker,
  Notice,
  OfflineBanner,
  Screen,
  StickyFooter,
  WizardHeader,
  type PickedLocation,
} from '@shared/components';
import { GpsUnavailableError } from '@shared/location/LocationService';
import { Location } from '@shared/models/Location';
import { colors } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { useReportDraft } from '../../context/ReportDraftProvider';
import { LocationSummary } from '../../components/LocationSummary';
import type { CommunityStackParamList } from '../../navigation/types';
import { WIZARD_CONTEXT, WIZARD_TOTAL } from './wizard';

type Props = NativeStackScreenProps<CommunityStackParamList, 'ReportLocation'>;
type GpsState = 'idle' | 'locating' | 'failed';

function gpsFailureMessage(e: unknown): string {
  if (e instanceof GpsUnavailableError) {
    switch (e.reason) {
      case 'permission':
        return 'Location permission was denied for RangerNet.';
      case 'disabled':
        return 'Location (GPS) is turned off on this phone.';
      case 'timeout':
        return 'A GPS position could not be found here.';
      default:
        return e.message;
    }
  }
  return getErrorMessage(e, 'The GPS position could not be read.');
}

/** UC-04 main flow step 2: location by GPS, or marked manually on the map / described (alternative flow). */
export function ReportLocationScreen({ navigation, route }: Props) {
  const editing = !!route.params?.editing;
  const draft = useReportDraft();
  const { report, update, clearIssue } = draft;
  const location = report?.location ?? null;
  const issue = draft.issueFor('location');
  // With no location yet, GPS is fetched automatically as soon as the step opens.
  const [gps, setGps] = useState<GpsState>(() => (location ? 'idle' : 'locating'));
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const mounted = useRef(true);
  const autoLocated = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onGpsFix = useCallback(
    (loc: Location) => {
      if (!mounted.current) return;
      update((r) => {
        r.location = loc;
      });
      clearIssue('location');
      setGps('idle');
    },
    [update, clearIssue],
  );

  const onGpsError = useCallback((e: unknown) => {
    if (!mounted.current) return;
    setGpsError(gpsFailureMessage(e));
    setGps('failed');
  }, []);

  const locate = useCallback(() => {
    setGps('locating');
    setGpsError(null);
    Location.getGPSLocation().then(onGpsFix, onGpsError);
  }, [onGpsFix, onGpsError]);

  useEffect(() => {
    if (autoLocated.current) return;
    autoLocated.current = true;
    if (!location) Location.getGPSLocation().then(onGpsFix, onGpsError);
  }, [location, onGpsFix, onGpsError]);

  const pickerInitial =
    location && location.hasCoordinates()
      ? { latitude: location.latitude as number, longitude: location.longitude as number }
      : null;

  const onPicked = (p: PickedLocation) => {
    const next =
      p.latitude !== null && p.longitude !== null
        ? Location.markLocation(p.latitude, p.longitude, p.description)
        : Location.describe(p.description ?? '');
    update((r) => {
      r.location = next;
    });
    clearIssue('location');
    setGps('idle');
    setPicker(false);
  };

  const onContinue = () => {
    const problem = report?.validateReport().find((i) => i.step === 'location');
    if (problem) {
      draft.raise(problem);
      return;
    }
    if (editing) navigation.goBack();
    else navigation.navigate('ReportDetails');
  };

  const locating = gps === 'locating';

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={2} total={WIZARD_TOTAL} title="Where is it happening?" context={WIZARD_CONTEXT} />
      <OfflineBanner />
      <Screen>
        {locating ? (
          <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <ActivityIndicator color={colors.forest500} />
            <View style={{ flex: 1 }}>
              <AppText size={14} weight="medium">
                Getting your GPS position…
              </AppText>
              <AppText size={12} color={colors.muted}>
                Stay where you are for a moment, preferably under open sky.
              </AppText>
            </View>
          </Card>
        ) : null}

        {location ? (
          <Card style={{ padding: 14 }}>
            <AppText size={12} weight="semibold" color={colors.muted} style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {location.manuallyMarked ? 'Location marked manually' : 'GPS position captured'}
            </AppText>
            <LocationSummary location={location} mapHeight={200} />
          </Card>
        ) : !locating ? (
          <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' }}>
              <MapPinIcon size={19} color={colors.forest500} />
            </View>
            <AppText size={13} color={colors.muted} style={{ flex: 1 }} lineHeight={19}>
              No location yet. Use GPS, or mark the place on the map.
            </AppText>
          </Card>
        ) : null}

        {gps === 'failed' ? (
          <Notice
            tone="warn"
            icon={SatelliteDishIcon}
            title="GPS unavailable – mark the location manually"
            message={`${gpsError ?? ''} Tap "Mark on map" to drop a pin or type coordinates. Without a map you can also describe the place, e.g. the village, road or nearest landmark.`}
            style={{ marginTop: 12 }}
          />
        ) : null}

        {issue ? <Notice tone="critical" icon={TriangleAlertIcon} message={issue} style={{ marginTop: 12 }} /> : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Button variant="outline" icon={CrosshairIcon} onPress={locate} loading={locating} style={{ flex: 1 }}>
            Use GPS again
          </Button>
          <Button variant="secondary" icon={MapPinnedIcon} onPress={() => setPicker(true)} disabled={locating} style={{ flex: 1 }}>
            Mark on map
          </Button>
        </View>
        <AppText size={12} color={colors.muted} lineHeight={17} style={{ marginTop: 12 }}>
          Not at the place right now? Mark it on the map or describe where it is.
        </AppText>
      </Screen>
      <StickyFooter>
        <Button full size="lg" onPress={onContinue} disabled={locating}>
          {editing ? 'Save and return to review' : 'Continue'}
        </Button>
      </StickyFooter>
      <LocationPicker
        visible={picker}
        title="Mark conflict location"
        initial={pickerInitial}
        initialDescription={location?.locationDescription}
        allowDescription
        onCancel={() => setPicker(false)}
        onConfirm={onPicked}
      />
    </View>
  );
}
