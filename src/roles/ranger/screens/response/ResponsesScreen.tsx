import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CloudOffIcon, SirenIcon, TriangleAlertIcon } from 'lucide-react-native';
import {
  AppBar,
  BellButton,
  EmptyState,
  LoadingBlock,
  Notice,
  OfflineBanner,
  RecordCard,
  Screen,
  Tabs,
} from '@shared/components';
import { colors } from '@shared/theme';
import { useLookups } from '@shared/lookups/useLookups';
import { formatCode, relativeTime } from '@shared/utils/format';
import { useMyResponses } from '../../services/useResponses';
import { useRangerNavigation } from '../../navigation/types';

const TABS = ['Active', 'Resolved'] as const;
type Tab = (typeof TABS)[number];

/** UC-04 (ranger side): high-risk conflicts a Community Liaison Officer coordinated with this ranger. */
export function ResponsesScreen() {
  const navigation = useRangerNavigation();
  const { items, loading, error, fromCache, reload } = useMyResponses();
  const { conflictTypeName } = useLookups();
  const [tab, setTab] = useState<Tab>('Active');
  const list = useMemo(() => items.filter((i) => (tab === 'Active' ? i.assignment.isActive : !i.assignment.isActive)), [items, tab]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Field Responses" subtitle="Human-wildlife conflict responses" right={<BellButton />} hideBack />
      <OfflineBanner />
      <View style={{ backgroundColor: colors.white, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </View>
      <Screen onRefresh={reload} refreshing={loading && items.length > 0}>
        {fromCache ? <Notice tone="warn" icon={CloudOffIcon} message="Offline copy of your responses." style={{ marginBottom: 12 }} /> : null}
        {error && items.length === 0 ? (
          <EmptyState icon={TriangleAlertIcon} tone="critical" title="Could not load responses" message={error} actionLabel="Retry" onAction={reload} />
        ) : loading && items.length === 0 ? (
          <LoadingBlock label="Loading responses…" />
        ) : list.length === 0 ? (
          <EmptyState
            icon={SirenIcon}
            title={tab === 'Active' ? 'No active responses' : 'No resolved responses'}
            message="When a Community Liaison Officer coordinates a high-risk conflict response with you, it appears here."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {list.map(({ assignment: a, pending }) => {
              const r = a.row.report;
              return (
                <RecordCard
                  key={a.assignmentId}
                  code={r ? formatCode('CR', r.report_no) : 'CR-····'}
                  title={r ? conflictTypeName(r.type_id) : 'Conflict report'}
                  subtitle={`Assigned ${relativeTime(a.assignedAt)}${r?.location?.location_description ? ` · ${r.location.location_description}` : ''}`}
                  badges={[
                    a.responseStatus,
                    ...(r?.is_high_risk ? ['High Risk'] : []),
                    ...(r?.severity ? [r.severity] : []),
                    ...(pending ? [pending.failed ? 'Failed' : 'Pending Sync'] : []),
                  ]}
                  thumbTone="warn"
                  onPress={() => navigation.navigate('ResponseDetail', { assignmentId: a.assignmentId })}
                />
              );
            })}
          </View>
        )}
      </Screen>
    </View>
  );
}
