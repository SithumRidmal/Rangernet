import { getLocalDb } from './localDb';
import { newId } from '../utils/id';

export type OutboxStatus = 'pending' | 'failed';

export interface OutboxItem<T = unknown> {
  id: string;
  entity: string;
  op: string;
  /** Items with the same group key are synchronized strictly in order (e.g. one patrol). */
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

type Row = {
  id: string;
  entity: string;
  op: string;
  group_key: string | null;
  label: string;
  payload: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
  status: OutboxStatus;
};

const toItem = <T>(r: Row): OutboxItem<T> => ({
  id: r.id,
  entity: r.entity,
  op: r.op,
  groupKey: r.group_key,
  label: r.label,
  payload: JSON.parse(r.payload) as T,
  createdAt: r.created_at,
  attempts: r.attempts,
  lastError: r.last_error,
  status: r.status,
});

type Listener = () => void;

export class LocalStorageError extends Error {
  constructor(message = 'Could not save the record on this device.') {
    super(message);
    this.name = 'LocalStorageError';
  }
}

/**
 * LocalStorage (class diagram): device-side store for records that could not be
 * delivered to the Central Operations System ("Pending Synchronization").
 */
export class LocalStorage {
  readonly storageId = 'rangernet.db';
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
      const db = await getLocalDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO outbox (id, entity, op, group_key, label, payload, created_at, attempts, last_error, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, 'pending')`,
        item.id,
        item.entity,
        item.op,
        item.groupKey,
        item.label,
        JSON.stringify(item.payload),
        item.createdAt,
      );
    } catch (e) {
      throw new LocalStorageError(e instanceof Error ? `Could not save on this device: ${e.message}` : undefined);
    }
    await this.refreshCounters();
    this.emit();
    return item;
  }

  /** saveIncident (UC-01, alternative flow 8a) */
  saveIncident<T>(payload: T, label: string, id?: string) {
    return this.save({ entity: 'incident', op: 'create', label, payload, id });
  }

  /** saveCommunityReport (UC-04, offline storage) */
  saveCommunityReport<T>(payload: T, label: string, id?: string) {
    return this.save({ entity: 'community_report', op: 'create', label, payload, id });
  }

  async retrieveAll<T = unknown>(): Promise<OutboxItem<T>[]> {
    const db = await getLocalDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM outbox ORDER BY created_at ASC');
    return rows.map((r) => toItem<T>(r));
  }

  async retrieveByEntity<T = unknown>(entity: string): Promise<OutboxItem<T>[]> {
    const db = await getLocalDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM outbox WHERE entity = ? ORDER BY created_at ASC', entity);
    return rows.map((r) => toItem<T>(r));
  }

  /** retrieveIncident: pending incidents waiting for synchronization */
  retrieveIncident<T = unknown>() {
    return this.retrieveByEntity<T>('incident');
  }

  /** retrieveCommunityReport: pending community reports waiting for synchronization */
  retrieveCommunityReport<T = unknown>() {
    return this.retrieveByEntity<T>('community_report');
  }

  async remove(id: string): Promise<void> {
    const db = await getLocalDb();
    await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
    await this.refreshCounters();
    this.emit();
  }

  /** removeIncident: called once the Central Operations System confirmed the record */
  removeIncident(id: string) {
    return this.remove(id);
  }

  async recordAttempt(id: string, error: string, final: boolean): Promise<void> {
    const db = await getLocalDb();
    await db.runAsync(
      'UPDATE outbox SET attempts = attempts + 1, last_error = ?, status = ? WHERE id = ?',
      error,
      final ? 'failed' : 'pending',
      id,
    );
    await this.refreshCounters();
    this.emit();
  }

  async resetFailed(id?: string): Promise<void> {
    const db = await getLocalDb();
    if (id) await db.runAsync("UPDATE outbox SET status = 'pending' WHERE id = ?", id);
    else await db.runAsync("UPDATE outbox SET status = 'pending' WHERE status = 'failed'");
    this.emit();
  }

  async logSynced(item: OutboxItem): Promise<void> {
    const db = await getLocalDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_log (id, entity, label, synced_at) VALUES (?, ?, ?, ?)',
      item.id,
      item.entity,
      item.label,
      new Date().toISOString(),
    );
    await db.runAsync('DELETE FROM sync_log WHERE id NOT IN (SELECT id FROM sync_log ORDER BY synced_at DESC LIMIT 50)');
  }

  async recentSynced(): Promise<SyncLogEntry[]> {
    const db = await getLocalDb();
    const rows = await db.getAllAsync<{ id: string; entity: string; label: string; synced_at: string }>(
      'SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT 50',
    );
    return rows.map((r) => ({ id: r.id, entity: r.entity, label: r.label, syncedAt: r.synced_at }));
  }

  async counts(): Promise<{ pending: number; failed: number }> {
    const db = await getLocalDb();
    const row = await db.getFirstAsync<{ pending: number; failed: number }>(
      `SELECT SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed FROM outbox`,
    );
    return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
  }

  private async refreshCounters() {
    const db = await getLocalDb();
    const row = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) AS c FROM outbox WHERE entity = 'incident'");
    this.pendingIncidents = row?.c ?? 0;
  }
}

export const localStore = new LocalStorage();
