import { capturePhoto as openCamera, deleteLocalPhoto } from '@shared/media/photos';

/** IncidentPhoto (class diagram): photoId, photoPath, capturedAt; capturePhoto(), retakePhoto(). */
export class IncidentPhoto {
  constructor(
    readonly photoId: string,
    /** Local file URI until synchronized, then the storage path. */
    public photoPath: string,
    readonly capturedAt: string,
  ) {}

  /** capturePhoto(): activates the device camera (UC-01 steps 4-5). Returns null when cancelled. */
  static async capturePhoto(): Promise<IncidentPhoto | null> {
    const shot = await openCamera();
    return shot ? new IncidentPhoto(shot.photoId, shot.uri, shot.capturedAt) : null;
  }

  /** retakePhoto(): alternative flow 5a - replaces an unclear photograph. */
  async retakePhoto(): Promise<IncidentPhoto | null> {
    const next = await IncidentPhoto.capturePhoto();
    if (next) this.discard();
    return next;
  }

  discard() {
    if (this.photoPath.startsWith('file:')) deleteLocalPhoto(this.photoPath);
  }

  storagePath(ownerId: string, incidentId: string): string {
    return `${ownerId}/${incidentId}/${this.photoId}.jpg`;
  }
}
