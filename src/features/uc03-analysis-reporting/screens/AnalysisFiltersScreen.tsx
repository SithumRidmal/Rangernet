import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarRangeIcon, LayersIcon, MapPinIcon, TreesIcon } from 'lucide-react-native';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  FilterChips,
  LoadingBlock,
  Notice,
  OfflineBanner,
  Screen,
  StickyFooter,
  WizardHeader,
} from '@shared/components';
import { useProfile } from '@shared/auth/AuthProvider';
import { useLookups } from '@shared/lookups/useLookups';
import { useSync } from '@shared/sync/SyncProvider';
import { colors } from '@shared/theme';
import { DateField } from '../components/DateField';
import { ParkSelector } from '../components/ParkSelector';
import { ANALYSIS_TYPE_LABELS, type DatePreset, type DateRange, type FilterErrors } from '../models/types';
import type { ParkManagerStackParamList } from '../navigation/types';
import { analysisController } from '../services/AnalysisController';
import { DATE_PRESETS, DATE_PRESET_LABELS, formatRange, presetRange } from '../services/dates';

const ALL_LOCATIONS = 'ALL';

type Props = NativeStackScreenProps<ParkManagerStackParamList, 'AnalysisFilters'>;

/** UC-03 step 3: park(s), location and date range; step 4 validation errors are shown inline. */
export function AnalysisFiltersScreen({ navigation, route }: Props) {
  const { type } = route.params;
  const profile = useProfile();
  const { parks, zones, loading, reload } = useLookups();
  const { online } = useSync();
  const [parkIds, setParkIds] = useState<string[]>(() => (profile.park_id ? [profile.park_id] : []));
  const [zoneId, setZoneId] = useState<string>(ALL_LOCATIONS);
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [custom, setCustom] = useState<DateRange>(() => presetRange('30d'));
  const [errors, setErrors] = useState<FilterErrors>({});

  const isCombined = parkIds.length > 1;
  const parkZones = useMemo(() => (parkIds.length === 1 ? zones.filter((z) => z.park_id === parkIds[0]) : []), [zones, parkIds]);
  const zoneOptions = useMemo(() => [ALL_LOCATIONS, ...parkZones.map((z) => z.zone_id)], [parkZones]);
  const zoneLabels = useMemo(
    () => Object.fromEntries([[ALL_LOCATIONS, 'All locations'], ...parkZones.map((z) => [z.zone_id, z.name])]) as Record<string, string>,
    [parkZones],
  );
  const dateRange: DateRange = preset === 'custom' ? custom : presetRange(preset);

  const togglePark = (id: string) => {
    setErrors((e) => ({ ...e, parks: undefined, location: undefined }));
    const next = parkIds.includes(id) ? parkIds.filter((p) => p !== id) : [...parkIds, id];
    setParkIds(next);
    if (next.length !== 1 || !zones.some((z) => z.zone_id === zoneId && z.park_id === next[0])) setZoneId(ALL_LOCATIONS);
  };

  const updateCustom = (patch: Partial<DateRange>) => {
    setErrors((e) => ({ ...e, dateRange: undefined }));
    setCustom((c) => ({ ...c, ...patch }));
  };

  const run = () => {
    const location = { parkIds, zoneId: isCombined || zoneId === ALL_LOCATIONS ? null : zoneId };
    const found = analysisController.validateFiltersAndCriteria(location, dateRange, zones);
    setErrors(found);
    if (Object.keys(found).length) return;
    navigation.navigate('Analyzing', { request: { type, location, dateRange } });
  };

  const body = () => {
    if (parks.length === 0 && loading) return <LoadingBlock label="Loading parks…" />;
    if (parks.length === 0) {
      return (
        <EmptyState
          icon={TreesIcon}
          tone="warn"
          title="Parks could not be loaded"
          message={online ? 'The park list is not available right now.' : 'Connect to the park server to load the park list.'}
          actionLabel="Retry"
          onAction={() => reload(true)}
        />
      );
    }
    return (
      <>
        <Field label="Park" required error={errors.parks} hint="Select one park, or several for a combined analysis.">
          <ParkSelector parks={parks} selected={parkIds} onToggle={togglePark} invalid={!!errors.parks} />
        </Field>
        {isCombined ? (
          <Notice
            tone="info"
            icon={LayersIcon}
            style={{ marginTop: 12 }}
            title="Multiple parks – combined analysis"
            message={`${parkIds.length} parks selected. Results are combined and compared per park across all locations.`}
          />
        ) : null}

        <Field label="Location" error={errors.location} style={{ marginTop: 20 }}>
          {isCombined ? (
            <Notice tone="info" icon={MapPinIcon} message="The location filter is not available for a combined analysis – all locations are included." />
          ) : parkIds.length === 0 ? (
            <AppText size={13} color={colors.muted}>
              Select a park to choose a location.
            </AppText>
          ) : (
            <FilterChips
              options={zoneOptions}
              value={zoneId}
              labels={zoneLabels}
              onChange={(v) => {
                setErrors((e) => ({ ...e, location: undefined }));
                setZoneId(v);
              }}
            />
          )}
        </Field>

        <Field label="Date range" required error={errors.dateRange} style={{ marginTop: 20 }}>
          <FilterChips
            options={DATE_PRESETS}
            value={preset}
            labels={DATE_PRESET_LABELS}
            onChange={(v) => {
              setErrors((e) => ({ ...e, dateRange: undefined }));
              if (v === 'custom' && preset !== 'custom') setCustom(dateRange);
              setPreset(v);
            }}
          />
          {preset === 'custom' ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <DateField label="From" value={custom.from} onChange={(from) => updateCustom({ from })} invalid={!!errors.dateRange} />
              <DateField label="To" value={custom.to} onChange={(to) => updateCustom({ to })} invalid={!!errors.dateRange} />
            </View>
          ) : null}
        </Field>

        <Card style={{ marginTop: 20, padding: 14, flexDirection: 'row', gap: 12 }}>
          <CalendarRangeIcon size={17} color={colors.forest500} style={{ marginTop: 1 }} />
          <AppText size={12.5} color={colors.muted} lineHeight={18} style={{ flex: 1 }}>
            {`${ANALYSIS_TYPE_LABELS[type]} for ${parkIds.length === 0 ? 'no park selected' : isCombined ? `${parkIds.length} parks` : parks.find((p) => p.park_id === parkIds[0])?.name ?? 'the selected park'}` +
              `${!isCombined && zoneId !== ALL_LOCATIONS ? ` (${zoneLabels[zoneId]})` : ''} · ${formatRange(dateRange)}.`}
          </AppText>
        </Card>
        {!online ? (
          <Notice tone="warn" style={{ marginTop: 12 }} message="You are offline. Running the analysis needs a connection to the park server." />
        ) : null}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <WizardHeader step={2} total={3} title="Analysis filters" context={ANALYSIS_TYPE_LABELS[type]} />
      <OfflineBanner />
      <Screen>{body()}</Screen>
      <StickyFooter>
        <Button full size="lg" onPress={run} disabled={parks.length === 0}>
          Run Analysis
        </Button>
      </StickyFooter>
    </View>
  );
}
