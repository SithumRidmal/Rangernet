import { capturePhoto, deleteLocalPhoto, localPhotoExists, pickPhoto, type LocalPhoto } from '@shared/media/photos';

export type PhotoSource = 'camera' | 'gallery';

/**
 * ReportPhoto (class diagram, composition 0..* of CommunityReport).
 * Before synchronization photoPath is the file:// URI on the device; after
 * delivery it is the storage path inside the private "report-photos" bucket.
 */
export class ReportPhoto {
  readonly photoId: string;
  photoPath: string;
  readonly capturedAt: string;

  constructor(photoId: string, photoPath: string, capturedAt: string) {
    this.photoId = photoId;
    this.photoPath = photoPath;
    this.capturedAt = capturedAt;
  }

  /** addPhoto(): capture with the camera or choose from the gallery. Null when the member cancels. */
  static async addPhoto(source: PhotoSource): Promise<ReportPhoto | null> {
    const local = source === 'camera' ? await capturePhoto() : await pickPhoto();
    return local ? ReportPhoto.fromLocal(local) : null;
  }

  /** removePhoto(): discards the local copy of a photo that was not submitted. */
  removePhoto(): void {
    if (this.isLocal()) deleteLocalPhoto(this.photoPath);
  }

  isLocal(): boolean {
    return this.photoPath.startsWith('file:');
  }

  existsOnDevice(): boolean {
    return this.isLocal() && localPhotoExists(this.photoPath);
  }

  storagePath(ownerId: string, reportId: string): string {
    return `${ownerId}/${reportId}/${this.photoId}.jpg`;
  }

  static fromLocal(p: LocalPhoto): ReportPhoto {
    return new ReportPhoto(p.photoId, p.uri, p.capturedAt);
  }

  toLocal(): LocalPhoto {
    return { photoId: this.photoId, uri: this.photoPath, capturedAt: this.capturedAt };
  }
}
