import { supabase } from '@shared/lib/supabase';
import { env } from '@shared/config/env';
import { unwrap } from '@shared/utils/errors';
import { localPhotoExists, uploadPhoto } from '@shared/media/photos';

export type IncidentPayload = {
  ownerId: string;
  incidentId: string;
  typeId: number;
  typeName: string;
  description: string;
  latitude: number;
  longitude: number;
  manuallyMarked: boolean;
  reportedAt: string;
  photos: { photoId: string; localUri: string; capturedAt: string }[];
};

export type StoredIncident = { incident_id: string; incident_no: number; status: string; already_stored: boolean };

export type PatrolPointPayload = {
  waypoint_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  waypoint_type: 'TRACK' | 'MARKED';
  manually_marked: boolean;
  note: string | null;
};

export type PatrolCompletion = {
  patrol_id: string;
  status: 'Completed' | 'Incomplete';
  already_completed: boolean;
  distance_covered: number | null;
  coverage_percent: number | null;
  planned_waypoints?: number;
  visited_waypoints?: number;
};

export type ResponseStatus = 'Acknowledged' | 'Responding' | 'Resolved';

export const incidentPhotoPath = (ownerId: string, incidentId: string, photoId: string) =>
  `${ownerId}/${incidentId}/${photoId}.jpg`;

/**
 * Central Operations System (sequence diagrams UC-01 / UC-02 / UC-04): the
 * Supabase RPCs the ranger app talks to. Every call is idempotent so records
 * delivered by the SynchronizationService can safely be retried.
 */
export const CentralOperationsSystem = {
  /** storeIncident(): photos go to private storage first, then the incident record. */
  async storeIncident(payload: IncidentPayload, isOffline: boolean): Promise<StoredIncident> {
    const photos = [];
    for (const p of payload.photos) {
      const path = incidentPhotoPath(payload.ownerId, payload.incidentId, p.photoId);
      // Local files are only deleted after the incident was stored, so a missing file was already uploaded.
      if (localPhotoExists(p.localUri)) await uploadPhoto(env.incidentPhotoBucket, p.localUri, path);
      photos.push({ photo_id: p.photoId, photo_path: path, captured_at: p.capturedAt });
    }
    return unwrap<StoredIncident>(
      await supabase.rpc('submit_incident', {
        p_incident_id: payload.incidentId,
        p_type_id: payload.typeId,
        p_description: payload.description,
        p_latitude: payload.latitude,
        p_longitude: payload.longitude,
        p_manually_marked: payload.manuallyMarked,
        p_reported_at: payload.reportedAt,
        p_is_offline: isOffline,
        p_photos: photos,
      }),
    );
  },

  /** Create patrol session + record start time (UC-02 step 4). */
  async createPatrolSession(patrolId: string, startTime: string): Promise<void> {
    unwrap(await supabase.rpc('start_patrol', { p_patrol_id: patrolId, p_start_time: startTime }));
  },

  /** Store GPS positions / marked waypoints (UC-02 steps 5-6). */
  async storePatrolPoints(patrolId: string, points: PatrolPointPayload[]): Promise<number> {
    return unwrap<number>(await supabase.rpc('record_patrol_points', { p_patrol_id: patrolId, p_points: points }));
  },

  /** Record completion time and calculate route & coverage (UC-02 step 7 / exception 14a). */
  async completePatrol(patrolId: string, endTime: string, completed: boolean, reason: string | null): Promise<PatrolCompletion> {
    return unwrap<PatrolCompletion>(
      await supabase.rpc('complete_patrol', {
        p_patrol_id: patrolId,
        p_end_time: endTime,
        p_completed: completed,
        p_reason: reason,
      }),
    );
  },

  /** ResponseAssignment.updateResponseStatus (UC-04: ranger acknowledges / responds / resolves). */
  async updateResponseStatus(assignmentId: string, status: ResponseStatus, notes: string | null): Promise<void> {
    unwrap(await supabase.rpc('update_response_status', { p_assignment_id: assignmentId, p_status: status, p_notes: notes }));
  },
};
