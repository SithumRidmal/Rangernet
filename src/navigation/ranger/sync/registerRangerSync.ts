import { registerSyncHandler } from '@shared/sync/SynchronizationService';
import { assertRecordOwner } from '@shared/lib/session';
import { deleteLocalPhoto } from '@shared/media/photos';
import { CentralOperationsSystem, type IncidentPayload, type ResponseStatus } from '@navigation/ranger/CentralOperationsSystem';
import { patrolSessionStore } from '@features/uc02-patrol-tracking/ranger/services/patrolSessionStore';
import type { PatrolCompletePayload, PatrolPointsPayload, PatrolStartPayload } from '@features/uc02-patrol-tracking/ranger/services/PatrolTracker';

export type ResponseUpdatePayload = {
  ownerId: string;
  assignmentId: string;
  reportNo: number | null;
  status: ResponseStatus;
  notes: string | null;
};

/** How ranger records stored offline are delivered when connectivity returns. */
export function registerRangerSync() {
  // UC-01 12a: SynchronizationService.synchronizeIncident -> storeIncident -> removeIncident
  registerSyncHandler<IncidentPayload>('incident', 'create', async ({ payload }) => {
    await assertRecordOwner(payload.ownerId);
    await CentralOperationsSystem.storeIncident(payload, true);
    payload.photos.forEach((p) => deleteLocalPhoto(p.localUri));
  });

  // UC-02 9a / 17a: patrol data recorded offline
  registerSyncHandler<PatrolStartPayload>('patrol', 'start', async ({ payload }) => {
    await assertRecordOwner(payload.ownerId);
    await CentralOperationsSystem.createPatrolSession(payload.patrolId, payload.startTime);
  });

  registerSyncHandler<PatrolPointsPayload>('patrol', 'points', async ({ payload }) => {
    await assertRecordOwner(payload.ownerId);
    await CentralOperationsSystem.storePatrolPoints(payload.patrolId, payload.points);
  });

  registerSyncHandler<PatrolCompletePayload>('patrol', 'complete', async ({ payload }) => {
    await assertRecordOwner(payload.ownerId);
    const result = await CentralOperationsSystem.completePatrol(payload.patrolId, payload.endTime, payload.completed, payload.reason);
    await patrolSessionStore.setResult(payload.patrolId, result).catch(() => undefined);
  });

  // UC-04: ranger acknowledges / responds / resolves a coordinated field response
  registerSyncHandler<ResponseUpdatePayload>('response', 'update', async ({ payload }) => {
    await assertRecordOwner(payload.ownerId);
    await CentralOperationsSystem.updateResponseStatus(payload.assignmentId, payload.status, payload.notes);
  });
}
