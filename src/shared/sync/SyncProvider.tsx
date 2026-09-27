import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { localStore } from './LocalStorage';
import { synchronizationService, type SyncRunResult, type SyncStatus } from './SynchronizationService';
import { env } from '../config/env';

type SyncContextValue = {
  online: boolean;
  pending: number;
  failed: number;
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  forceOffline: boolean;
  setForceOffline: (v: boolean) => void;
  syncNow: (includeFailed?: boolean) => Promise<SyncRunResult>;
  refreshCounts: () => Promise<void>;
  /** Bumped every time the queue changes so screens can re-read local data. */
  version: number;
};

const SyncContext = createContext<SyncContextValue | null>(null);

// Local database may not be ready yet on first launch.
const readCounts = () => localStore.counts().catch(() => null);

/** Counts refresh through the queue subscription, so background runs don't need to await them. */
const backgroundSync = () => {
  synchronizationService.retrySynchronization().catch(() => undefined);
};

export function SyncProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [networkOnline, setNetworkOnline] = useState(true);
  const [forceOffline, setForceOfflineState] = useState(synchronizationService.forceOffline);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(synchronizationService.syncStatus);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const wasOnline = useRef(true);

  const online = networkOnline && !forceOffline;

  const applyCounts = useCallback((c: { pending: number; failed: number } | null) => {
    if (!c) return;
    setPending(c.pending);
    setFailed(c.failed);
  }, []);

  const refreshCounts = useCallback(async () => applyCounts(await readCounts()), [applyCounts]);

  const syncNow = useCallback(
    async (includeFailed = false) => {
      const result = await synchronizationService.retrySynchronization({ includeFailed });
      await refreshCounts();
      return result;
    },
    [refreshCounts],
  );

  useEffect(() => {
    const offQueue = localStore.subscribe(() => {
      refreshCounts();
      setVersion((v) => v + 1);
    });
    const offService = synchronizationService.subscribe(() => {
      setSyncStatus(synchronizationService.syncStatus);
      setLastSyncTime(synchronizationService.lastSyncTime);
      setForceOfflineState(synchronizationService.forceOffline);
    });
    readCounts().then(applyCounts);
    return () => {
      offQueue();
      offService();
    };
  }, [refreshCounts, applyCounts]);

  // Connection restored -> retrieve pending records and synchronize them.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setNetworkOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (online && !wasOnline.current) backgroundSync();
    wasOnline.current = online;
  }, [online, enabled]);

  useEffect(() => {
    if (!enabled) return;
    backgroundSync();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') backgroundSync();
    });
    return () => sub.remove();
  }, [enabled]);

  // Periodic retrySynchronization while records are still pending.
  useEffect(() => {
    if (!enabled || pending === 0 || !online) return;
    const t = setInterval(backgroundSync, env.syncRetryIntervalMs);
    return () => clearInterval(t);
  }, [enabled, pending, online]);

  const value = useMemo<SyncContextValue>(
    () => ({
      online,
      pending,
      failed,
      syncStatus: !online && pending > 0 ? 'Offline' : syncStatus,
      lastSyncTime,
      forceOffline,
      setForceOffline: (v: boolean) => synchronizationService.setForceOffline(v),
      syncNow,
      refreshCounts,
      version,
    }),
    [online, pending, failed, syncStatus, lastSyncTime, forceOffline, syncNow, refreshCounts, version],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside SyncProvider');
  return ctx;
}
