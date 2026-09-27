import { supabase } from '@shared/lib/supabase';
import { ServiceError, unwrap } from '@shared/utils/errors';
import { formatCode } from '@shared/utils/format';
import { ConflictType } from './ConflictType';
import { ReportPhoto } from './ReportPhoto';
import { ResponseAssignment } from './ResponseAssignment';
import {
  one,
  SEVERITIES,
  type CommunityReportRow,
  type LocationRow,
  type PersonRow,
  type ReportChannel,
  type ReportStatus,
  type Severity,
} from '../services/rows';

/** Statuses the CLO can store when no field response is required. */
export type AssessedStatus = 'Resolved' | 'Closed';

export class CommunityReport {
  reportId: string;
  reportNo: number;
  description: string;
  reportedAt: string;
  status: ReportStatus;
  reportChannel: ReportChannel;
  isOffline: boolean;
  severity: Severity | null;
  isHighRisk: boolean;
  flaggedDuplicate: boolean;
  duplicateOf: string | null;
  assessmentNote: string | null;
  reviewedAt: string | null;
  smsSender: string | null;
  parkId: string | null;
  zoneId: string | null;
  conflictType: ConflictType;
  location: LocationRow | null;
  photos: ReportPhoto[];
  assignment: ResponseAssignment | null;
  member: PersonRow | null;

  private constructor(row: CommunityReportRow) {
    this.reportId = row.report_id;
    this.reportNo = row.report_no;
    this.description = row.description;
    this.reportedAt = row.reported_at;
    this.status = row.status;
    this.reportChannel = row.report_channel;
    this.isOffline = row.is_offline;
    this.severity = row.severity;
    this.isHighRisk = row.is_high_risk;
    this.flaggedDuplicate = row.flagged_duplicate;
    this.duplicateOf = row.duplicate_of;
    this.assessmentNote = row.assessment_note;
    this.reviewedAt = row.reviewed_at;
    this.smsSender = row.sms_sender;
    this.parkId = row.park_id;
    this.zoneId = row.zone_id;
    this.conflictType = ConflictType.fromRow(one(row.conflict_type), row.type_id);
    this.location = one(row.location);
    this.photos = (row.photos ?? []).map(ReportPhoto.fromRow);
    const a = one(row.assignment);
    this.assignment = a ? ResponseAssignment.fromRow(a) : null;
    this.member = one(row.member);
  }

  static fromRow(row: CommunityReportRow): CommunityReport {
    return new CommunityReport(row);
  }

  get code(): string {
    return formatCode('CR', this.reportNo);
  }

  get isOpen(): boolean {
    return this.status === 'Reported' || this.status === 'Under Review' || this.status === 'Responding';
  }

  /** Exception flow: flagged by the system and not yet confirmed or cleared by the CLO. */
  get isPossibleDuplicate(): boolean {
    return this.flaggedDuplicate && this.status !== 'Duplicate';
  }

  get isAssessed(): boolean {
    return this.severity !== null;
  }

  get hasCoordinates(): boolean {
    return this.location?.latitude != null && this.location?.longitude != null;
  }

  get reporterName(): string {
    if (this.member?.full_name) return this.member.full_name;
    if (this.reportChannel === 'SMS') return this.smsSender ? `SMS ${this.smsSender}` : 'SMS reporter';
    return 'Community member';
  }

  get reporterContact(): string | null {
    return this.member?.contact_number || this.smsSender || null;
  }

  get village(): string | null {
    return this.member?.village || null;
  }

  badges(): string[] {
    const b: string[] = [this.status];
    if (this.isHighRisk) b.push('High Risk');
    else if (this.severity) b.push(this.severity);
    b.push(this.reportChannel);
    if (this.isPossibleDuplicate) b.push('Possible Duplicate');
    return b;
  }

  /** CommunityReport.assessSeverity – stores severity / high-risk and returns the stored severity. */
  async assessSeverity(severity: Severity, isHighRisk: boolean, note: string): Promise<string> {
    if (!SEVERITIES.includes(severity)) throw new ServiceError('Please select a severity level', '22023');
    const res = unwrap(
      await supabase.rpc('assess_conflict_severity', {
        p_report_id: this.reportId,
        p_severity: severity,
        p_is_high_risk: isHighRisk,
        p_note: note.trim() || null,
      }),
    ) as { severity: Severity; is_high_risk: boolean; status: ReportStatus };
    this.severity = res.severity;
    this.isHighRisk = res.is_high_risk;
    this.status = res.status;
    this.assessmentNote = note.trim() || null;
    return res.severity;
  }

  /** CommunityReport.updateStatus – "No field response required → store assessed status". */
  async updateStatus(status: AssessedStatus | 'Under Review', note: string): Promise<void> {
    unwrap(
      await supabase.rpc('update_report_status', {
        p_report_id: this.reportId,
        p_status: status,
        p_note: note.trim() || null,
      }),
    );
    this.status = status;
    if (note.trim()) this.assessmentNote = note.trim();
  }
}
