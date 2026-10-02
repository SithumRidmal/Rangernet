import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CloudOffIcon, ShieldAlertIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  BellButton,
  Button,
  EmptyState,
  FilterChips,
  LoadingBlock,
  Notice,
  OfflineBanner,
  RecordCard,
  Screen,
  StickyFooter,
} from '@shared/components';
import { colors } from '@shared/theme';
import { relativeTime } from '@shared/utils/format';
import { useMyIncidents } from '../../services/useMyIncidents';
import { useRangerNavigation } from '@navigation/ranger/navigation/types';

const FILTERS = ['All', 'Pending Sync', 'Open', 'Resolved'] as const;
type Filter = (typeof FILTERS)[number];

export function MyIncidentsScreen() {
  const navigation = useRangerNavigation();
  const { items, loading, error, fromCache, reload } = useMyIncidents();
  const [filter, setFilter] = useState<Filter>('All');

  const list = useMemo(() => {
    switch (filter) {
      case 'Pending Sync':
        return items.filter((i) => i.sync !== 'Synced');
      case 'Open':
        return items.filter((i) => i.status !== 'Resolved');
      case 'Resolved':
        return items.filter((i) => i.status === 'Resolved');
      default:
        return items;
    }
  }, [filter, items]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="My Incidents" subtitle="Incidents you have reported" right={<BellButton />} hideBack />
      <OfflineBanner />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12 }}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </View>
      <Screen onRefresh={reload} refreshing={loading && items.length > 0}>
        {fromCache ? (
          <Notice tone="warn" icon={CloudOffIcon} message="Showing incidents saved on this device. Pull to refresh when online." style={{ marginBottom: 12 }} />
        ) : null}
        {error && items.length === 0 ? (
          <EmptyState
            icon={TriangleAlertIcon}
            tone="critical"
            title="Could not load incidents"
            message={error}
            actionLabel="Retry"
            onAction={reload}
          />
        ) : loading && items.length === 0 ? (
          <LoadingBlock label="Loading incidents…" />
        ) : list.length === 0 ? (
          <EmptyState
            icon={ShieldAlertIcon}
            title="No incidents here"
            message="Incidents you report will appear in this list, including those waiting to be synchronized."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {list.map((i) => (
              <RecordCard
                key={i.key}
                code={i.code}
                title={i.typeName}
                subtitle={`${relativeTime(i.reportedAt)} · ${i.description}`}
                badges={[i.status, ...(i.sync !== 'Synced' ? [i.sync] : []), ...(i.manuallyMarked ? ['Manual'] : [])]}
                thumbUri={i.thumbUri}
                onPress={() => navigation.navigate('IncidentDetail', { incidentId: i.incidentId })}
              />
            ))}
          </View>
        )}
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={ShieldAlertIcon} onPress={() => navigation.navigate('IncidentType')}>
          Report New Incident
        </Button>
      </StickyFooter>
    </View>
  );
}
