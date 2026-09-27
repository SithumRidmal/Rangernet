import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CrosshairIcon,
  InfoIcon,
  MessageSquareOffIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  SendIcon,
  TriangleAlertIcon,
} from 'lucide-react-native';
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Notice,
  RadioRow,
  Screen,
  StickyFooter,
  useToast,
} from '@shared/components';
import { useProfile } from '@shared/auth/AuthProvider';
import { env } from '@shared/config/env';
import { getGPSLocation, GpsUnavailableError } from '@shared/location/LocationService';
import { useLookups } from '@shared/lookups/useLookups';
import { colors, fonts, radius } from '@shared/theme';
import { getErrorMessage } from '@shared/utils/errors';
import { ConflictType } from '../models/ConflictType';
import { conflictVisual } from '../components/conflictVisuals';
import {
  buildSmsMessage,
  formatSmsCoordinates,
  isSmsReportingConfigured,
  sendSmsReport,
} from '../services/SmsReportService';
import type { CommunityStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CommunityStackParamList, 'SmsReport'>;
type Errors = Partial<Record<'type' | 'location' | 'details', string>>;

/** UC-04 alternative flow: report by SMS (report channel SMS, created by the SMS gateway). */
export function SmsReportScreen({ navigation }: Props) {
  const profile = useProfile();
  const toast = useToast();
  const { conflictTypes } = useLookups();
  const types = useMemo(() => conflictTypes.map((t) => ConflictType.fromLookup(t)), [conflictTypes]);
  const [type, setType] = useState<ConflictType | null>(null);
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  if (!isSmsReportingConfigured()) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
        <AppBar title="Report by SMS" />
        <EmptyState
          icon={MessageSquareOffIcon}
          title="SMS reporting is not available"
          message="No SMS number has been set up for your area. Please report in the app instead – it also works offline."
          actionLabel="Report in the app"
          onAction={() => navigation.replace('ReportType')}
        />
      </View>
    );
  }

  const message = buildSmsMessage(type?.getTypeName() ?? '', location, details);

  const fillFromGps = async () => {
    setLocating(true);
    setGpsError(null);
    try {
      const p = await getGPSLocation();
      setLocation(formatSmsCoordinates(p.latitude, p.longitude));
      setErrors((e) => ({ ...e, location: undefined }));
    } catch (e) {
      setGpsError(
        e instanceof GpsUnavailableError
          ? `${e.message} Type a short description of the place instead (village, road or landmark).`
          : getErrorMessage(e),
      );
    } finally {
      setLocating(false);
    }
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!type) next.type = 'Please select a conflict type.';
    if (!location.trim()) next.location = 'Please add the location (GPS or a short description).';
    if (!details.trim()) next.details = 'Please describe what you saw.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const send = async () => {
    if (!validate()) return;
    setSending(true);
    setManual(null);
    try {
      const result = await sendSmsReport(message);
      if (result === 'unavailable') {
        setManual(message);
      } else if (result === 'cancelled') {
        toast.show('SMS not sent', 'warn');
      } else {
        toast.show(result === 'sent' ? 'SMS sent – the report will be created shortly' : 'SMS ready – make sure you pressed send', 'ok');
        navigation.goBack();
      }
    } catch (e) {
      setManual(message);
      toast.show(getErrorMessage(e, 'The SMS app could not be opened.'), 'warn');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Report by SMS" subtitle={`To ${env.smsReportNumber} · no internet data needed`} />
      <Screen>
        <Notice
          tone="info"
          icon={InfoIcon}
          message="Your phone's SMS app opens with a ready message. The RangerNet SMS gateway creates the report with channel SMS and links it to you using your registered contact number."
        />
        {!profile.contact_number ? (
          <Notice
            tone="warn"
            icon={PhoneIcon}
            title="No contact number registered"
            message="Add your mobile number in your profile so SMS reports can be matched to you and appear in My Reports."
            action="Open profile"
            onAction={() => navigation.navigate('Profile')}
            style={{ marginTop: 10 }}
          />
        ) : (
          <AppText size={12} color={colors.muted} style={{ marginTop: 8 }}>
            Send from {profile.contact_number} so the report appears in My Reports.
          </AppText>
        )}

        <Field label="Conflict type" required error={errors.type} style={{ marginTop: 18 }}>
          <View style={{ gap: 8 }}>
            {types.map((t) => (
              <RadioRow
                key={t.typeId}
                icon={conflictVisual(t.typeId).icon}
                label={t.getTypeName()}
                selected={type?.typeId === t.typeId}
                onSelect={() => {
                  setType(t);
                  setErrors((e) => ({ ...e, type: undefined }));
                }}
              />
            ))}
          </View>
        </Field>

        <Field
          label="Location"
          required
          error={errors.location}
          hint="Use GPS, or describe the place, e.g. paddy field behind the Kirinda temple"
          style={{ marginTop: 18 }}
        >
          <Input
            value={location}
            invalid={!!errors.location}
            placeholder="Coordinates or description"
            onChangeText={(t) => {
              setLocation(t);
              if (t.trim()) setErrors((e) => ({ ...e, location: undefined }));
            }}
          />
        </Field>
        <Button variant="outline" size="sm" icon={CrosshairIcon} loading={locating} onPress={fillFromGps} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
          Use my GPS position
        </Button>
        {gpsError ? <Notice tone="warn" icon={TriangleAlertIcon} message={gpsError} style={{ marginTop: 8 }} /> : null}

        <Field label="Details" required error={errors.details} style={{ marginTop: 18 }}>
          <Input
            multiline
            value={details}
            maxLength={300}
            invalid={!!errors.details}
            placeholder="e.g. 2 elephants in the banana field, still there"
            onChangeText={(t) => {
              setDetails(t);
              if (t.trim()) setErrors((e) => ({ ...e, details: undefined }));
            }}
            style={{ minHeight: 80 }}
          />
        </Field>

        <AppText size={12} weight="semibold" color={colors.muted} style={{ marginTop: 18, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Message preview
        </AppText>
        <Card style={{ padding: 14, backgroundColor: colors.white }}>
          <AppText selectable size={13} lineHeight={19} style={{ fontFamily: fonts.medium }}>
            {message}
          </AppText>
        </Card>

        {manual ? (
          <View style={{ marginTop: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warn, backgroundColor: colors.warnBg, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MessageSquareTextIcon size={16} color={colors.warn} />
              <AppText size={13} weight="semibold" color={colors.warnText}>
                SMS cannot be sent from this device
              </AppText>
            </View>
            <AppText size={12} color={colors.warnText} lineHeight={17}>
              Send this text manually from any phone to the number below. Keep the lines exactly as shown.
            </AppText>
            <AppText selectable size={16} weight="bold" color={colors.ink}>
              {env.smsReportNumber}
            </AppText>
            <AppText selectable size={13} lineHeight={19} style={{ fontFamily: fonts.medium }}>
              {manual}
            </AppText>
          </View>
        ) : null}
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={SendIcon} loading={sending} onPress={send}>
          Open SMS app
        </Button>
      </StickyFooter>
    </View>
  );
}
