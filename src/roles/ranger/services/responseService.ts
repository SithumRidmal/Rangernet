import { localStore, type OutboxItem } from '@shared/sync/LocalStorage';
import { synchronizationService } from '@shared/sync/SynchronizationService';
import type { ResponseStatus } from './CentralOperationsSystem';
import type { ResponseUpdatePayload } from '../sync/registerRangerSync';

export type PendingResponseUpdate = { status: ResponseStatus; failed: boolean; error: string | null; itemId: string };

/** Latest locally stored status per assignment (shown until it reaches the server). */
export async function pendingResponseUpdates(): Promise<Map<string, PendingResponseUpdate>> {
  const items = await localStore.retrieveByEntity<ResponseUpdatePayload>('response');
  const map = new Map<string, PendingResponseUpdate>();
  items.forEach((i) =>
    map.set(i.payload.assignmentId, { status: i.payload.status, failed: i.status === 'failed', error: i.lastError, itemId: i.id }),
  );
  return map;
}

export type ResponseUpdateOutcome = { delivered: boolean; failedMessage: string | null };

/**
 * Every status change goes through the outbox so updates for one assignment are
 * always delivered in order, then an immediate synchronization is attempted.
 */
export async function recordResponseStatus(payload: ResponseUpdatePayload): Promise<ResponseUpdateOutcome> {
  const item: OutboxItem<ResponseUpdatePayload> = await localStore.save({
    entity: 'response',
    op: 'update',
    groupKey: payload.assignmentId,
    label: `Response ${payload.reportNo ? `CR-${String(payload.reportNo).padStart(4, '0')} ` : ''}→ ${payload.status}`,
    payload,
  });
  const find = async () => (await localStore.retrieveByEntity<ResponseUpdatePayload>('response')).find((i) => i.id === item.id);
  await synchronizationService.retrySynchronization();
  let still = await find();
  // A run that was already in progress may have started before this item was saved.
  if (still && still.status === 'pending' && still.attempts === 0) {
    await synchronizationService.retrySynchronization();
    still = await find();
  }
  if (!still) return { delivered: true, failedMessage: null };
  return { delivered: false, failedMessage: still.status === 'failed' ? still.lastError : null };
}
