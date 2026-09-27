import React, { useState } from 'react';
import { Modal as RNModal, View } from 'react-native';
import { MapPinIcon } from 'lucide-react-native';
import type { LatLng } from 'react-native-maps';
import { colors } from '../../theme';
import { AppText } from '../ui/AppText';
import { AppBar, StickyFooter } from '../ui/chrome';
import { Button, Field, Input, Notice } from '../ui/primitives';
import { MapPanel } from './MapPanel';

export type PickedLocation = { latitude: number | null; longitude: number | null; description: string | null };

/**
 * Manual location marking (UC-01 alt 6a, UC-04 manual location). Works without map
 * tiles too: coordinates can be typed in, or (when allowed) a text description given.
 */
type PickerProps = {
  title?: string;
  /** Read when the picker opens; later changes while it is open are ignored. */
  initial?: LatLng | null;
  initialDescription?: string | null;
  allowDescription?: boolean;
  onCancel: () => void;
  onConfirm: (loc: PickedLocation) => void;
};

export function LocationPicker({ visible, onCancel, ...rest }: PickerProps & { visible: boolean }) {
  return (
    <RNModal visible={visible} animationType="slide" onRequestClose={onCancel}>
      {visible ? <PickerBody onCancel={onCancel} {...rest} /> : null}
    </RNModal>
  );
}

function PickerBody({
  title = 'Mark location manually',
  initial,
  initialDescription,
  allowDescription,
  onCancel,
  onConfirm,
}: PickerProps) {
  const [point, setPoint] = useState<LatLng | null>(initial ?? null);
  const [lat, setLat] = useState(initial ? initial.latitude.toFixed(6) : '');
  const [lng, setLng] = useState(initial ? initial.longitude.toFixed(6) : '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [error, setError] = useState<string | null>(null);

  const onMapPress = (c: LatLng) => {
    setPoint(c);
    setLat(c.latitude.toFixed(6));
    setLng(c.longitude.toFixed(6));
    setError(null);
  };

  const confirm = () => {
    const la = lat.trim() ? Number(lat) : NaN;
    const lo = lng.trim() ? Number(lng) : NaN;
    const hasCoords = Number.isFinite(la) && Number.isFinite(lo);
    if (hasCoords) {
      if (Math.abs(la) > 90 || Math.abs(lo) > 180 || (la === 0 && lo === 0)) {
        setError('Invalid coordinates. Tap the map or enter a valid latitude and longitude.');
        return;
      }
      onConfirm({ latitude: la, longitude: lo, description: description.trim() || null });
      return;
    }
    if (allowDescription && description.trim()) {
      onConfirm({ latitude: null, longitude: null, description: description.trim() });
      return;
    }
    setError(allowDescription ? 'Tap the map, enter coordinates or describe the location.' : 'Tap the map or enter coordinates.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar title={title} subtitle="Tap the map to drop a pin" onBack={onCancel} />
      <MapPanel
        height={300}
        rounded={false}
        onPress={onMapPress}
        autoFit={false}
        center={point ?? initial ?? null}
        markers={point ? [{ id: 'picked', latitude: point.latitude, longitude: point.longitude, kind: 'selected' }] : []}
        showsUserLocation
      />
      <View style={{ flex: 1, padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MapPinIcon size={16} color={colors.forest500} />
          <AppText size={13} color={colors.muted} style={{ flex: 1 }}>
            No map tiles offline? Type the coordinates from your handheld GPS instead.
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Latitude" style={{ flex: 1 }}>
            <Input value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="6.372800" />
          </Field>
          <Field label="Longitude" style={{ flex: 1 }}>
            <Input value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" placeholder="81.516900" />
          </Field>
        </View>
        {allowDescription ? (
          <Field label="Location description" hint="e.g. Paddy field behind Kirinda temple">
            <Input value={description} onChangeText={setDescription} placeholder="Describe the place" />
          </Field>
        ) : null}
        {error ? <Notice tone="critical" message={error} /> : null}
      </View>
      <StickyFooter>
        <Button full size="lg" onPress={confirm}>
          Use this location
        </Button>
      </StickyFooter>
    </View>
  );
}
