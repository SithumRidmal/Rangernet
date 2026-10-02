import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { CrosshairIcon, MapPinIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppText,
  Button,
  Card,
  LoadingBlock,
  LocationPicker,
  MapPanel,
  Notice,
  Screen,
  StatusBadge,
  StickyFooter,
  WizardHeader,
} from '@shared/components';
import { colors } from '@shared/theme';
import { Location } from '@shared/models/Location';
import { GpsUnavailableError } from '@shared/location/LocationService';
import { formatCoord } from '@shared/utils/format';
import { useLookups } from '@shared/lookups/useLookups';
import { useProfile } from '@shared/auth/AuthProvider';
import { useIncidentDraft } from '../../incident/IncidentDraftContext';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

type GpsStatus = 'locating' | 'found' | 'unavailable';

/** UC-01 step 6: the system obtains the GPS location (6a: GPS unavailable -> mark the location manually). */
export function IncidentLocationScreen({ navigation }: RangerScreenProps<'IncidentLocation'>) {
  const { incident, update } = useIncidentDraft();
  const profile = useProfile();
  const { parks } = useLookups();
  const [status, setStatus] = useState<GpsStatus>(incident?.location ? 'found' : 'locating');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const started = useRef(false);

  const locate = useCallback(async () => {
    setStatus('locating');
    setGpsError(null);
    try {
      const loc = await Location.getGPSLocation();
      update((i) => i.setLocation(loc));
      setStatus('found');
    } catch (e) {
      setGpsError(e instanceof GpsUnavailableError ? e.message : 'GPS location is unavailable.');
      setStatus('unavailable');
    }
  }, [update]);

  useEffect(() => {
    if (!started.current && incident && !incident.location) {
      started.current = true;
      void locate();
    }
  }, [incident, locate]);

  if (!incident) return null;
  const loc = incident.location;
  const park = parks.find((p) => p.park_id === profile.park_id);
  const fallbackCenter = park ? { latitude: park.center_lat, longitude: park.center_lng } : null;
  const point = loc && loc.latitude !== null && loc.longitude !== null ? { latitude: loc.latitude, longitude: loc.longitude } : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={3} total={5} title="Where is the incident?" context={incident.type.getTypeName()} />
      <Screen>
        {status === 'locating' ? (
          <Card style={{ paddingVertical: 8 }}>
            <LoadingBlock label="Getting your GPS position…" />
          </Card>
        ) : null}

        {status === 'unavailable' && !point ? (
          <Notice
            tone="warn"
            icon={TriangleAlertIcon}
            title="GPS location unavailable"
            message={`${gpsError ?? ''} You can mark the incident location manually on the map or by entering coordinates.`}
          />
        ) : null}

        {point ? (
          <>
            <MapPanel height={230} markers={[{ id: 'incident', ...point, kind: 'incident', label: 'Incident' }]} center={point} />
            <Card style={{ padding: 14, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                {loc?.manuallyMarked ? (
                  <MapPinIcon size={18} color={colors.warn} style={{ marginTop: 2 }} />
                ) : (
                  <CrosshairIcon size={18} color={colors.forest500} style={{ marginTop: 2 }} />
                )}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AppText size={14} weight="medium">
                      {loc?.manuallyMarked ? 'Location marked manually' : 'GPS position captured'}
                    </AppText>
                    <StatusBadge status={loc?.manuallyMarked ? 'Manual' : 'GPS'} size="sm" dot={false} />
                  </View>
                  <AppText size={13} color={colors.muted} style={{ marginTop: 2 }}>
                    {formatCoord(point.latitude, point.longitude)}
                  </AppText>
                  {loc?.accuracy ? (
                    <AppText size={12} color={colors.muted}>
                      Accuracy ±{Math.round(loc.accuracy)} m
                    </AppText>
                  ) : null}
                </View>
              </View>
            </Card>
          </>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button variant="outline" icon={CrosshairIcon} style={{ flex: 1 }} onPress={() => void locate()} disabled={status === 'locating'}>
            {point && !loc?.manuallyMarked ? 'Refresh GPS' : 'Try GPS again'}
          </Button>
          <Button variant="secondary" icon={MapPinIcon} style={{ flex: 1 }} onPress={() => setPicking(true)}>
            Mark manually
          </Button>
        </View>
      </Screen>
      <StickyFooter>
        <Button full size="lg" disabled={!point} onPress={() => navigation.navigate('IncidentDescription')}>
          Continue
        </Button>
      </StickyFooter>

      <LocationPicker
        visible={picking}
        title="Mark incident location"
        initial={point ?? fallbackCenter}
        onCancel={() => setPicking(false)}
        onConfirm={(p) => {
          setPicking(false);
          if (p.latitude === null || p.longitude === null) return;
          const marked = Location.markLocation(p.latitude, p.longitude);
          update((i) => i.setLocation(marked));
          setStatus('found');
        }}
      />
    </View>
  );
}
