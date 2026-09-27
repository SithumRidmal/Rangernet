import { env } from '@shared/config/env';
import type { ReportPhotoRow } from '../services/rows';

/** Read-only for the CLO: photos are captured by the community member. */
export class ReportPhoto {
  static readonly bucket = env.reportPhotoBucket;

  constructor(
    public readonly photoId: string,
    public readonly photoPath: string,
    public readonly capturedAt: string,
  ) {}

  static fromRow(row: ReportPhotoRow): ReportPhoto {
    return new ReportPhoto(row.photo_id, row.photo_path, row.captured_at);
  }
}
