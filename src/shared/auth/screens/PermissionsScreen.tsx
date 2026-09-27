import React, { useState } from 'react';
import { View } from 'react-native';
import * as ExpoLocation from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { CameraIcon, MapPinIcon, type LucideIcon } from 'lucide-react-native';
import { colors } from '../../theme';
import { AppText } from '../../components/ui/AppText';
import { AppBar, Screen, StickyFooter } from '../../components/ui/chrome';
import { Button, Card } from '../../components/ui/primitives';
import { StepDots } from '../../components/ui/composite';

type Step = { icon: LucideIcon; title: string; body: string; request: () => Promise<unknown> };

const STEPS: Step[] = [
  {
    icon: MapPinIcon,
    title: 'Location access',
    body: 'RangerNet tags every incident and conflict report with its exact position and records your patrol route. Without location you can still mark positions manually on the map.',
    request: () => ExpoLocation.requestForegroundPermissionsAsync(),
  },
  {
    icon: CameraIcon,
    title: 'Camera access',
    body: 'Photograph snares, carcasses, campsites, footprints and wildlife as evidence. Photos stay on the device until a connection is available.',
    request: () => ImagePicker.requestCameraPermissionsAsync(),
  },
];

/** Field setup shown once after the first sign-in for roles that capture field data. */
export function PermissionsScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const p = STEPS[step];
  const last = step === STEPS.length - 1;
  const Icon = p.icon;

  const next = () => (last ? onDone() : setStep((s) => s + 1));

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <AppBar
        title="Field setup"
        subtitle={`Step ${step + 1} of ${STEPS.length}`}
        onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
        hideBack={step === 0}
      />
      <Screen bg={colors.white}>
        <StepDots step={step} total={STEPS.length} />
        <View style={{ marginTop: 32 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={26} color={colors.forest500} strokeWidth={1.9} />
          </View>
          <AppText size={22} weight="semibold" style={{ marginTop: 20 }}>
            {p.title}
          </AppText>
          <AppText size={15} color={colors.muted} style={{ marginTop: 10 }} lineHeight={23}>
            {p.body}
          </AppText>
        </View>
        <Card style={{ marginTop: 28, padding: 16 }}>
          <AppText size={13} weight="semibold">
            What RangerNet never does
          </AppText>
          <View style={{ marginTop: 8, gap: 6 }}>
            <AppText size={13} color={colors.muted}>
              · Share your location outside the park operations team
            </AppText>
            <AppText size={13} color={colors.muted}>
              · Track you when you are not on an active patrol
            </AppText>
            <AppText size={13} color={colors.muted}>
              · Delete field records before they are synchronized
            </AppText>
          </View>
        </Card>
      </Screen>
      <StickyFooter>
        <Button
          full
          size="lg"
          onPress={async () => {
            try {
              await p.request();
            } finally {
              next();
            }
          }}
        >
          {last ? 'Allow & Continue' : 'Allow Access'}
        </Button>
        <Button full variant="ghost" onPress={next}>
          Not now
        </Button>
      </StickyFooter>
    </View>
  );
}
