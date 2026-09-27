import NetInfo from '@react-native-community/netinfo';
import { localStore, type OutboxItem } from './LocalStorage';
import { getErrorMessage, isRetryableError } from '../utils/errors';

export type SyncStatus = 'Synced' | 'Syncing' | 'Pending Sync' | 'Failed' | 'Offline';
export type SyncHandler<T = unknown> = (item: OutboxItem<T>) => Promise<void>;

const handlers = new Map<string, SyncHandler>();

/** Each role registers how its offline records are delivered to Supabase. */
export function registerSyncHandler<T>(entity: string, op: string, handler: SyncHandler<T>) {
  handlers.set(`${entity}.${op}`, handler as SyncHandler);
}

export type SyncRunResult = { synced: number; failed: number; remaining: number; offline: boolean };

type Listener = () => void;

/**
 * SynchronizationService (class diagram): delivers locally stored records to the
 * Central Operations System when connectivity returns and retries failures.
 */
export class SynchronizationService {
  syncStatus: SyncStatus = 'Synced';
  lastSyncTime: string | null = null;
  lastError: string | null = null;
  /** Lets testers demonstrate the offline flows without disabling the device network. */
  forceOffline = false;
  private running: Promise<SyncRunResult> | null = null;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: SyncStatus) {
    this.syncStatus = status;
    this.listeners.forEach((l) => l());
  }

  setForceOffline(value: boolean) {
    this.forceOffline = value;
    this.listeners.forEach((l) => l());
  }

  /** checkConnectivity(): Boolean */
  async checkConnectivity(): Promise<boolean> {
    if (this.forceOffline) return false;
    const state = await NetInfo.fetch();
    return !!state.isConnected && state.isInternetReachable !== false;
  }

  private async deliver(item: OutboxItem): Promise<void> {
    const handler = handlers.get(`${item.entity}.${item.op}`);
    if (!handler) throw new Error(`No synchronization handler registered for ${item.entity}.${item.op}`);
    await handler(item);
  }

  /** synchronizeIncident(): delivers one pending incident */
  synchronizeIncident(item: OutboxItem) {
    return this.synchronizeItem(item);
  }

  /** synchronizeCommunityReport(): delivers one pending community report */
  synchronizeCommunityReport(item: OutboxItem) {
    return this.synchronizeItem(item);
  }

  /** Delivers a single record; removes it from LocalStorage on success. */
  async synchronizeItem(item: OutboxItem): Promise<boolean> {
    try {
      await this.deliver(item);
      await localStore.logSynced(item);
      await localStore.remove(item.id);
      return true;
    } catch (e) {
      const final = !isRetryableError(e);
      await localStore.recordAttempt(item.id, getErrorMessage(e), final);
      throw e;
    }
  }

  /**
   * retrySynchronization(): processes the whole queue in FIFO order. Records that
   * fail with a network error stay pending and are retried on the next run.
   */
  retrySynchronization(options: { includeFailed?: boolean } = {}): Promise<SyncRunResult> {
    if (this.running) return this.running;
    this.running = this.run(options).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run({ includeFailed }: { includeFailed?: boolean }): Promise<SyncRunResult> {
    if (includeFailed) await localStore.resetFailed();
    const items = (await localStore.retrieveAll()).filter((i) => i.status === 'pending');
    if (items.length === 0) {
      const { failed } = await localStore.counts();
      this.setStatus(failed > 0 ? 'Failed' : 'Synced');
      return { synced: 0, failed, remaining: 0, offline: false };
    }
    if (!(await this.checkConnectivity())) {
      this.setStatus('Offline');
      return { synced: 0, failed: 0, remaining: items.length, offline: true };
    }

    this.setStatus('Syncing');
    let synced = 0;
    let failed = 0;
    let offline = false;
    const blockedGroups = new Set<string>();

    for (const item of items) {
      if (item.groupKey && blockedGroups.has(item.groupKey)) continue;
      try {
        await this.synchronizeItem(item);
        synced++;
      } catch (e) {
        this.lastError = getErrorMessage(e);
        if (item.groupKey) blockedGroups.add(item.groupKey);
        if (isRetryableError(e)) {
          if (!(await this.checkConnectivity())) {
            offline = true;
            break;
          }
        } else {
          failed++;
        }
      }
    }

    const counts = await localStore.counts();
    if (synced > 0) this.lastSyncTime = new Date().toISOString();
    this.setStatus(
      offline ? 'Offline' : counts.failed > 0 ? 'Failed' : counts.pending > 0 ? 'Pending Sync' : 'Synced',
    );
    return { synced, failed, remaining: counts.pending, offline };
  }
}

export const synchronizationService = new SynchronizationService();
