import { newId } from '../utils/id';

export type OutboxStatus = 'pending' | 'failed';

export interface OutboxItem<T = unknown> {
  id: string;
  entity: string;
  op: string;
  groupKey: string | null;
  label: string;
  payload: T;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: OutboxStatus;
}

export interface SyncLogEntry {
  id: string;
  entity: string;
  label: string;
  syncedAt: string;
}

type Listener = () => void;

const OUTBOX_KEY = 'rangernet:web:outbox';
const SYNC_LOG_KEY = 'rangernet:web:syncLog';

export class LocalStorageError extends Error {
  constructor(message = 'Could not save the record in this browser.') {
    super(message);
    this.name = 'LocalStorageError';
  }
}

export class LocalStorage {
  readonly storageId = 'browser-local-storage';
  pendingIncidents = 0;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async save<T>(params: {
    entity: string;
    op: string;
    label: string;
    payload: T;
    groupKey?: string | null;
    id?: string;
  }): Promise<OutboxItem<T>> {
    const item: OutboxItem<T> = {
      id: params.id ?? newId(),
      entity: params.entity,
      op: params.op,
      groupKey: params.groupKey ?? null,
      label: params.label,
      payload: params.payload,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
      status: 'pending',
    };
    try {
      const rows = readJson<OutboxItem[]>(OUTBOX_KEY, []);
      const next = [item, ...rows.filter((r) => r.id !== item.id)].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      writeJson(OUTBOX_KEY, next);
    } catch (e) {
      throw new LocalStorageError(e instanceof Error ? `Could not save in this browser: ${e.message}` : undefined);
    }
    await this.refreshCounters();
    this.emit();
    return item;
  }

  saveIncident<T>(payload: T, label: string, id?: string) {
    return this.save({ entity: 'incident', op: 'create', label, payload, id });
  }

  saveCommunityReport<T>(payload: T, label: string, id?: string) {
    return this.save({ entity: 'community_report', op: 'create', label, payload, id });
  }

  async retrieveAll<T = unknown>(): Promise<OutboxItem<T>[]> {
    return readJson<OutboxItem<T>[]>(OUTBOX_KEY, []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async retrieveByEntity<T = unknown>(entity: string): Promise<OutboxItem<T>[]> {
    const rows = await this.retrieveAll<T>();
    return rows.filter((r) => r.entity === entity);
  }

  retrieveIncident<T = unknown>() {
    return this.retrieveByEntity<T>('incident');
  }

  retrieveCommunityReport<T = unknown>() {
    return this.retrieveByEntity<T>('community_report');
  }

  async remove(id: string): Promise<void> {
    writeJson(
      OUTBOX_KEY,
      readJson<OutboxItem[]>(OUTBOX_KEY, []).filter((r) => r.id !== id),
    );
    await this.refreshCounters();
    this.emit();
  }

  removeIncident(id: string) {
    return this.remove(id);
  }

  async recordAttempt(id: string, error: string, final: boolean): Promise<void> {
    const rows = readJson<OutboxItem[]>(OUTBOX_KEY, []).map((r) =>
      r.id === id ? { ...r, attempts: r.attempts + 1, lastError: error, status: final ? 'failed' : 'pending' } : r,
    );
    writeJson(OUTBOX_KEY, rows);
    await this.refreshCounters();
    this.emit();
  }

  async resetFailed(id?: string): Promise<void> {
    const rows = readJson<OutboxItem[]>(OUTBOX_KEY, []).map((r) =>
      (!id && r.status === 'failed') || r.id === id ? { ...r, status: 'pending' as const } : r,
    );
    writeJson(OUTBOX_KEY, rows);
    this.emit();
  }

  async logSynced(item: OutboxItem): Promise<void> {
    const rows = readJson<SyncLogEntry[]>(SYNC_LOG_KEY, []);
    writeJson(SYNC_LOG_KEY, [{ id: item.id, entity: item.entity, label: item.label, syncedAt: new Date().toISOString() }, ...rows].slice(0, 50));
  }

  async recentSynced(): Promise<SyncLogEntry[]> {
    return readJson<SyncLogEntry[]>(SYNC_LOG_KEY, []).sort((a, b) => b.syncedAt.localeCompare(a.syncedAt)).slice(0, 50);
  }

  async counts(): Promise<{ pending: number; failed: number }> {
    const rows = readJson<OutboxItem[]>(OUTBOX_KEY, []);
    return {
      pending: rows.filter((r) => r.status === 'pending').length,
      failed: rows.filter((r) => r.status === 'failed').length,
    };
  }

  private async refreshCounters() {
    this.pendingIncidents = readJson<OutboxItem[]>(OUTBOX_KEY, []).filter((r) => r.entity === 'incident').length;
  }
}

export const localStore = new LocalStorage();

function readJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
