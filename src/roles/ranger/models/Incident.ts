import { Location } from '@shared/models/Location';
import { localStore } from '@shared/sync/LocalStorage';
import { synchronizationService } from '@shared/sync/SynchronizationService';
import { isRetryableError } from '@shared/utils/errors';
import { formatTime } from '@shared/utils/format';
import { newId } from '@shared/utils/id';
import { CentralOperationsSystem, type IncidentPayload } from '../services/CentralOperationsSystem';
import { IncidentPhoto } from './IncidentPhoto';
import { IncidentType } from './IncidentType';

export type MissingField = 'type' | 'photo' | 'location' | 'description';

export const MISSING_LABELS: Record<MissingField, string> = {
  type: 'Select the incident type',
  photo: 'Capture at least one photograph',
  location: 'Provide the incident location (GPS or marked manually)',
  description: 'Enter a short description',
};

export class IncidentValidationError extends Error {
  constructor(readonly missing: MissingField[]) {
    super('Some required information is missing.');
    this.name = 'IncidentValidationError';
  }
}

export type SubmitOutcome =
  | { kind: 'stored'; incidentId: string; incidentNo: number; status: string }
  | { kind: 'pending'; incidentId: string };

export const INCIDENT_DESCRIPTION_MAX = 600;

/**
 * Incident (class diagram): incidentId, description, reportedAt, status, isOffline;
 * createIncident(), validateIncident(), submitIncident().
 * Composed of IncidentType, IncidentPhoto[] and Location.
 */
export class Incident {
  readonly incidentId: string;
  description = '';
  reportedAt: string | null = null;
  status = 'Reported';
  isOffline = false;
  type: IncidentType;
  photos: IncidentPhoto[] = [];
  location: Location | null = null;

  private constructor(type: IncidentType) {
    this.incidentId = newId();
    this.type = type;
  }

  /** createIncident(type) - UC-01 step 3. */
  static createIncident(type: IncidentType): Incident {
    return new Incident(type);
  }

  setType(type: IncidentType) {
    this.type = type;
  }

  addPhoto(photo: IncidentPhoto) {
    this.photos = [...this.photos, photo];
  }

  replacePhoto(previous: IncidentPhoto, next: IncidentPhoto) {
    this.photos = this.photos.map((p) => (p.photoId === previous.photoId ? next : p));
  }

  removePhoto(photo: IncidentPhoto) {
    photo.discard();
    this.photos = this.photos.filter((p) => p.photoId !== photo.photoId);
  }

  setLocation(location: Location | null) {
    this.location = location;
  }

  /** setDescription(description) - UC-01 step 7. */
  setDescription(description: string) {
    this.description = description.slice(0, INCIDENT_DESCRIPTION_MAX);
  }

  missingInformation(): MissingField[] {
    const missing: MissingField[] = [];
    if (!this.type) missing.push('type');
    if (this.photos.length === 0) missing.push('photo');
    if (!this.location || !this.location.hasCoordinates()) missing.push('location');
    if (!this.description.trim()) missing.push('description');
    return missing;
  }

  /** validateIncident(): Boolean - UC-01 step 9 (exception 9a lists what is missing). */
  validateIncident(): boolean {
    return this.missingInformation().length === 0;
  }

  toPayload(ownerId: string): IncidentPayload {
    const loc = this.location;
    if (!loc || loc.latitude === null || loc.longitude === null) throw new IncidentValidationError(['location']);
    return {
      ownerId,
      incidentId: this.incidentId,
      typeId: this.type.typeId,
      typeName: this.type.getTypeName(),
      description: this.description.trim(),
      latitude: loc.latitude,
      longitude: loc.longitude,
      manuallyMarked: loc.manuallyMarked,
      reportedAt: this.reportedAt ?? new Date().toISOString(),
      photos: this.photos.map((p) => ({ photoId: p.photoId, localUri: p.photoPath, capturedAt: p.capturedAt })),
    };
  }

  /**
   * submitIncident() - UC-01 steps 8-12.
   * Network available: stored directly in the Central Operations System.
   * No connection (8a): stored in LocalStorage as "Pending Synchronization".
   * A LocalStorageError (11a) is thrown to the UI so the ranger can retry saving.
   */
  async submitIncident(ownerId: string): Promise<SubmitOutcome> {
    if (!this.validateIncident()) throw new IncidentValidationError(this.missingInformation());
    this.reportedAt = this.reportedAt ?? new Date().toISOString();

    if (await synchronizationService.checkConnectivity()) {
      try {
        const stored = await CentralOperationsSystem.storeIncident(this.toPayload(ownerId), false);
        this.status = stored.status;
        this.photos.forEach((p) => p.discard());
        return { kind: 'stored', incidentId: stored.incident_id, incidentNo: stored.incident_no, status: stored.status };
      } catch (e) {
        if (!isRetryableError(e)) throw e;
      }
    }
    return this.saveLocally(ownerId);
  }

  /** LocalStorage.saveIncident(incident) - also used by the "Retry" action of exception 11a. */
  async saveLocally(ownerId: string): Promise<SubmitOutcome> {
    this.isOffline = true;
    this.reportedAt = this.reportedAt ?? new Date().toISOString();
    await localStore.saveIncident(
      this.toPayload(ownerId),
      `${this.type.getTypeName()} incident · ${formatTime(this.reportedAt)}`,
      this.incidentId,
    );
    return { kind: 'pending', incidentId: this.incidentId };
  }
}
