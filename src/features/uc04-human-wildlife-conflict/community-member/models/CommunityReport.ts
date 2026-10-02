import { Location } from '@shared/models/Location';
import { env } from '@shared/config/env';
import { uploadPhoto } from '@shared/media/photos';
import { newId } from '@shared/utils/id';
import { ConflictType } from './ConflictType';
import { ReportPhoto } from './ReportPhoto';
import { assignmentOf, storeCommunityReport } from '../services/ReportRepository';
import type {
  AssignmentRow,
  CommunityReportPayload,
  CommunityReportRow,
  ReportChannel,
  ReportStatus,
  Severity,
  SubmitReportResult,
} from '../services/types';

export type WizardStep = 'type' | 'location' | 'details';
export type ValidationIssue = { step: WizardStep; message: string };

export const MAX_DESCRIPTION = 1000;
export const MAX_PHOTOS = 4;

type Init = {
  reportId: string;
  reportNo?: number | null;
  description?: string;
  reportedAt?: string;
  status?: ReportStatus;
  reportChannel?: ReportChannel;
  isOffline?: boolean;
  location?: Location | null;
  conflictType?: ConflictType | null;
  photos?: ReportPhoto[];
  severity?: Severity | null;
  isHighRisk?: boolean;
  flaggedDuplicate?: boolean;
  reviewedAt?: string | null;
  assessmentNote?: string | null;
  updatedAt?: string | null;
  assignment?: AssignmentRow | null;
};

/** CommunityReport (class diagram) – UC-04 Report Human-Wildlife Conflict. */
export class CommunityReport {
  reportId: string;
  reportNo: number | null;
  description: string;
  reportedAt: string;
  status: ReportStatus;
  reportChannel: ReportChannel;
  isOffline: boolean;
  location: Location | null;
  conflictType: ConflictType | null;
  photos: ReportPhoto[];
  severity: Severity | null;
  isHighRisk: boolean;
  flaggedDuplicate: boolean;
  reviewedAt: string | null;
  assessmentNote: string | null;
  updatedAt: string | null;
  assignment: AssignmentRow | null;

  constructor(init: Init) {
    this.reportId = init.reportId;
    this.reportNo = init.reportNo ?? null;
    this.description = init.description ?? '';
    this.reportedAt = init.reportedAt ?? new Date().toISOString();
    this.status = init.status ?? 'Reported';
    this.reportChannel = init.reportChannel ?? 'APP';
    this.isOffline = init.isOffline ?? false;
    this.location = init.location ?? null;
    this.conflictType = init.conflictType ?? null;
    this.photos = init.photos ?? [];
    this.severity = init.severity ?? null;
    this.isHighRisk = init.isHighRisk ?? false;
    this.flaggedDuplicate = init.flaggedDuplicate ?? false;
    this.reviewedAt = init.reviewedAt ?? null;
    this.assessmentNote = init.assessmentNote ?? null;
    this.updatedAt = init.updatedAt ?? null;
    this.assignment = init.assignment ?? null;
  }

  /** createReport(): a new report with a device-generated id (offline-safe, idempotent delivery). */
  static createReport(): CommunityReport {
    return new CommunityReport({ reportId: newId(), reportChannel: 'APP' });
  }

  /** validateReport(): returns the missing / invalid information, grouped by wizard step. */
  validateReport(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!this.conflictType) issues.push({ step: 'type', message: 'Please select a conflict type.' });
    const loc = this.location;
    const hasCoordinateFields = !!loc && loc.latitude !== null && loc.longitude !== null;
    if (!loc || (!hasCoordinateFields && !loc.locationDescription?.trim())) {
      issues.push({ step: 'location', message: 'Please provide the location by GPS, by marking it on the map or by describing it.' });
    } else if (hasCoordinateFields && !loc.hasCoordinates()) {
      issues.push({ step: 'location', message: 'Invalid location. Please mark the location again.' });
    }
    if (!this.description.trim()) {
      issues.push({ step: 'details', message: 'Please enter a description of what you saw.' });
    } else if (this.description.length > MAX_DESCRIPTION) {
      issues.push({ step: 'details', message: `The description can be at most ${MAX_DESCRIPTION} characters.` });
    }
    return issues;
  }

  /**
   * submitReport(): uploads the photos and stores the report through the Data Repository.
   * Throws on failure so the caller can fall back to Local Storage or report the validation error.
   */
  async submitReport(ownerId: string, isOffline: boolean): Promise<SubmitReportResult> {
    const location = this.location ?? new Location();
    const deliverable = this.photos.filter((p) => !p.isLocal() || p.existsOnDevice());
    const photos: { photo_id: string; photo_path: string; captured_at: string }[] = [];
    for (const photo of deliverable) {
      const path = photo.isLocal()
        ? await uploadPhoto(env.reportPhotoBucket, photo.photoPath, photo.storagePath(ownerId, this.reportId))
        : photo.photoPath;
      photos.push({ photo_id: photo.photoId, photo_path: path, captured_at: photo.capturedAt });
    }
    const result = await storeCommunityReport({
      p_report_id: this.reportId,
      p_type_id: this.conflictType?.typeId ?? 0,
      p_description: this.description.trim(),
      p_latitude: location.latitude,
      p_longitude: location.longitude,
      p_manually_marked: location.manuallyMarked,
      p_location_description: location.locationDescription?.trim() || null,
      p_reported_at: this.reportedAt,
      p_is_offline: isOffline,
      p_photos: photos,
    });
    this.reportNo = result.report_no;
    this.isOffline = isOffline;
    this.flaggedDuplicate = result.flagged_duplicate;
    this.updateStatus(result.status);
    return result;
  }

  /** assessSeverity(): severity is assessed by the Community Liaison Officer; the member only reads it. */
  assessSeverity(): string {
    return this.severity ?? 'Not assessed yet';
  }

  updateStatus(status: ReportStatus): void {
    this.status = status;
  }

  isOpen(): boolean {
    return this.status === 'Reported' || this.status === 'Under Review' || this.status === 'Responding';
  }

  isResolved(): boolean {
    return this.status === 'Resolved' || this.status === 'Closed';
  }

  clone(): CommunityReport {
    return new CommunityReport({ ...this, photos: [...this.photos] });
  }

  toPayload(ownerId: string): CommunityReportPayload {
    const loc = this.location ?? new Location();
    return {
      ownerId,
      reportId: this.reportId,
      typeId: this.conflictType?.typeId ?? 0,
      typeName: this.conflictType?.getTypeName() ?? '',
      description: this.description.trim(),
      latitude: loc.latitude,
      longitude: loc.longitude,
      manuallyMarked: loc.manuallyMarked,
      locationDescription: loc.locationDescription?.trim() || null,
      accuracy: loc.accuracy,
      reportedAt: this.reportedAt,
      photos: this.photos.filter((p) => p.isLocal()).map((p) => p.toLocal()),
    };
  }

  static fromPayload(p: CommunityReportPayload): CommunityReport {
    return new CommunityReport({
      reportId: p.reportId,
      description: p.description,
      reportedAt: p.reportedAt,
      isOffline: true,
      conflictType: new ConflictType(p.typeId, p.typeName),
      location: new Location({
        latitude: p.latitude,
        longitude: p.longitude,
        manuallyMarked: p.manuallyMarked,
        locationDescription: p.locationDescription,
        accuracy: p.accuracy,
      }),
      photos: p.photos.map((ph) => ReportPhoto.fromLocal(ph)),
    });
  }

  static fromRow(row: CommunityReportRow): CommunityReport {
    return new CommunityReport({
      reportId: row.report_id,
      reportNo: row.report_no,
      description: row.description,
      reportedAt: row.reported_at,
      status: row.status,
      reportChannel: row.report_channel,
      isOffline: row.is_offline,
      severity: row.severity,
      isHighRisk: row.is_high_risk,
      flaggedDuplicate: row.flagged_duplicate,
      reviewedAt: row.reviewed_at,
      assessmentNote: row.assessment_note,
      updatedAt: row.updated_at,
      assignment: assignmentOf(row),
      conflictType: row.conflict_type ? new ConflictType(row.conflict_type.type_id, row.conflict_type.type_name) : null,
      location: row.location
        ? new Location({
            latitude: row.location.latitude,
            longitude: row.location.longitude,
            manuallyMarked: row.location.manually_marked,
            locationDescription: row.location.location_description,
          })
        : null,
      photos: (row.photos ?? []).map((p) => new ReportPhoto(p.photo_id, p.photo_path, p.captured_at)),
    });
  }
}
