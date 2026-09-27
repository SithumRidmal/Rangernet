import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  CheckCircle2Icon,
  CloudIcon,
  CloudOffIcon,
  FileWarningIcon,
  RefreshCwIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react-native';
import { colors } from '../theme';
import { AppText } from '../components/ui/AppText';
import { AppBar, Modal, Screen, StickyFooter, SyncIndicator } from '../components/ui/chrome';
import { Button, Card, Divider, EmptyState, StatusBadge, Tabs, Toggle } from '../components/ui/primitives';
import { useToast } from '../components/ui/Toast';
import { localStore, type OutboxItem, type SyncLogEntry } from './LocalStorage';
import { synchronizationService } from './SynchronizationService';
import { useSync } from './SyncProvider';
import { relativeTime } from '../utils/format';

const TABS = ['Pending', 'Synced', 'Failed'] as const;
type Tab = (typeof TABS)[number];

const ENTITY_LABEL: Record<string, string> = {
  incident: 'Incident report',
  community_report: 'Conflict report',
  patrol: 'Patrol data',
  response: 'Response update',
};

const readQueue = () => Promise.all([localStore.retrieveAll(), localStore.recentSynced()]);

export function SyncCenterScreen() {
  const { online, pending, failed, syncStatus, lastSyncTime, syncNow, forceOffline, setForceOffline, version } = useSync();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Pending');
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [synced, setSynced] = useState<SyncLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState<OutboxItem | null>(null);

  const load = useCallback(async () => {
    const [queued, recent] = await readQueue();
    setItems(queued);
    setSynced(recent);
  }, []);

  useEffect(() => {
    let alive = true;
    readQueue().then(([queued, recent]) => {
      if (!alive) return;
      setItems(queued);
      setSynced(recent);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const syncAll = async () => {
    setBusy(true);
    try {
      const r = await syncNow(true);
      if (r.offline) toast.show('No connection. Records stay on this device and sync automatically.', 'warn');
      else if (r.failed > 0) toast.show(`${r.synced} synced · ${r.failed} need attention`, 'critical');
      else toast.show(r.synced > 0 ? `${r.synced} record${r.synced === 1 ? '' : 's'} synchronized` : 'Everything is up to date', 'ok');
    } finally {
      setBusy(false);
      load();
    }
  };

  const retryOne = async (item: OutboxItem) => {
    await localStore.resetFailed(item.id);
    if (!(await synchronizationService.checkConnectivity())) {
      toast.show('Still offline. The record will retry automatically.', 'warn');
      return;
    }
    try {
      await synchronizationService.synchronizeItem({ ...item, status: 'pending' });
      toast.show('Record synchronized', 'ok');
    } catch {
      toast.show('Synchronization failed again. It stays on this device.', 'critical');
    }
    load();
  };

  const list = tab === 'Pending' ? items.filter((i) => i.status === 'pending') : items.filter((i) => i.status === 'failed');

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest50 }}>
      <AppBar title="Sync Center" subtitle={online ? 'Connected' : 'Offline'} />
      <Screen onRefresh={load} refreshing={false}>
        <Card style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: online ? colors.okBg : colors.warnBg,
              }}
            >
              {online ? <CloudIcon size={22} color={colors.ok} /> : <CloudOffIcon size={22} color={colors.warn} />}
            </View>
            <View style={{ flex: 1 }}>
              <AppText size={15} weight="semibold">
                {pending + failed === 0 ? 'All records synchronized' : `${pending + failed} record${pending + failed === 1 ? '' : 's'} on this device`}
              </AppText>
              <AppText size={12} color={colors.muted}>
                Last sync {lastSyncTime ? relativeTime(lastSyncTime) : 'not yet in this session'}
              </AppText>
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <SyncIndicator state={syncStatus} detail={`${pending} pending · ${failed} failed`} />
          </View>
        </Card>

        <Tabs tabs={TABS} value={tab} onChange={setTab} style={{ marginTop: 16 }} labels={{ Pending: `Pending (${pending})`, Failed: `Failed (${failed})` }} />

        <View style={{ marginTop: 12, gap: 10 }}>
          {tab === 'Synced' ? (
            synced.length === 0 ? (
              <EmptyState icon={CheckCircle2Icon} title="Nothing synced yet" message="Records delivered to the operations system appear here." />
            ) : (
              <Card>
                {synced.map((s, i) => (
                  <View key={s.id}>
                    {i > 0 ? <Divider /> : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                      <CheckCircle2Icon size={18} color={colors.ok} />
                      <View style={{ flex: 1 }}>
                        <AppText size={14} weight="medium" numberOfLines={1}>
                          {s.label}
                        </AppText>
                        <AppText size={12} color={colors.muted}>
                          {ENTITY_LABEL[s.entity] ?? s.entity} · {relativeTime(s.syncedAt)}
                        </AppText>
                      </View>
                      <StatusBadge status="Synced" size="sm" />
                    </View>
                  </View>
                ))}
              </Card>
            )
          ) : list.length === 0 ? (
            <EmptyState
              icon={tab === 'Pending' ? CloudIcon : FileWarningIcon}
              title={tab === 'Pending' ? 'No pending records' : 'No failed records'}
              message={
                tab === 'Pending'
                  ? 'Records captured without a connection are stored here as "Pending Synchronization".'
                  : 'Records the server rejected appear here so you can retry or discard them.'
              }
            />
          ) : (
            list.map((item) => (
              <Card key={item.id} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: item.status === 'failed' ? colors.critBg : colors.warnBg,
                    }}
                  >
                    {item.status === 'failed' ? <TriangleAlertIcon size={17} color={colors.crit} /> : <CloudIcon size={17} color={colors.warn} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText size={14} weight="medium">
                      {item.label}
                    </AppText>
                    <AppText size={12} color={colors.muted}>
                      {ENTITY_LABEL[item.entity] ?? item.entity} · saved {relativeTime(item.createdAt)}
                      {item.attempts ? ` · ${item.attempts} attempt${item.attempts === 1 ? '' : 's'}` : ''}
                    </AppText>
                    {item.lastError ? (
                      <AppText size={12} color={item.status === 'failed' ? colors.crit : colors.warnText} style={{ marginTop: 4 }}>
                        {item.lastError}
                      </AppText>
                    ) : null}
                  </View>
                  <StatusBadge status={item.status === 'failed' ? 'Failed' : 'Pending Sync'} size="sm" />
                </View>
                {item.status === 'failed' ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Button size="sm" variant="secondary" icon={RefreshCwIcon} onPress={() => retryOne(item)} style={{ flex: 1 }}>
                      Retry
                    </Button>
                    <Button size="sm" variant="outline" icon={Trash2Icon} onPress={() => setDiscard(item)} style={{ flex: 1 }}>
                      Discard
                    </Button>
                  </View>
                ) : null}
              </Card>
            ))
          )}
        </View>

        <Card style={{ marginTop: 16 }}>
          <Toggle
            checked={forceOffline}
            onChange={setForceOffline}
            label="Simulate offline mode"
            description="Keeps new records on this device (Pending Synchronization) even when a network is available. Turn off to sync."
          />
        </Card>
      </Screen>
      <StickyFooter>
        <Button full size="lg" icon={RefreshCwIcon} onPress={syncAll} loading={busy} disabled={pending + failed === 0}>
          Sync All Now
        </Button>
      </StickyFooter>
      <Modal
        open={!!discard}
        onClose={() => setDiscard(null)}
        tone="critical"
        icon={Trash2Icon}
        title="Discard this record?"
        description="It will be permanently removed from this device and never reach the operations system."
        actions={
          <>
            <Button
              variant="danger"
              full
              onPress={async () => {
                if (discard) await localStore.remove(discard.id);
                setDiscard(null);
                load();
              }}
            >
              Discard record
            </Button>
            <Button variant="ghost" full onPress={() => setDiscard(null)}>
              Keep it
            </Button>
          </>
        }
      />
    </View>
  );
}
