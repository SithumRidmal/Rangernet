import { localStore } from '@shared/sync/LocalStorage';
import { synchronizationService } from '@shared/sync/SynchronizationService';
import { deleteLocalPhoto } from '@shared/media/photos';
import { isRetryableError, ServiceError } from '@shared/utils/errors';
import { formatTime } from '@shared/utils/format';
import { CommunityReport, type ValidationIssue, type WizardStep } from '../models/CommunityReport';
import type { CommunityMember } from '../models/CommunityMember';
import type { ReportStatus } from './types';

/** Missing or invalid information; each issue points to the wizard step the member must complete again. */
export class ReportValidationError extends Error {
  readonly issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(issues[0]?.message ?? 'Please complete the report.');
    this.name = 'ReportValidationError';
    this.issues = issues;
  }
}

export type SubmitOutcome =
  | { kind: 'delivered'; reportNo: number; status: ReportStatus; flaggedDuplicate: boolean }
  | { kind: 'stored'; reason: 'offline' | 'network' };

function stepForServerMessage(message: string): WizardStep | null {
  if (/conflict type/i.test(message)) return 'type';
  if (/location/i.test(message)) return 'location';
  if (/description/i.test(message)) return 'details';
  return null;
}

function toSubmitError(e: unknown): unknown {
  if (e instanceof ServiceError && e.code === '22023') {
    const step = stepForServerMessage(e.message);
    if (step) return new ReportValidationError([{ step, message: e.message }]);
  }
  return e;
}

/** Report Controller (sequence diagram): createReport, validateReport, submitReport. */
export class ReportController {
  createReport(): CommunityReport {
    return CommunityReport.createReport();
  }

  validateReport(report: CommunityReport): ValidationIssue[] {
    return report.validateReport();
  }

  /**
   * Online: deliver directly to the Data Repository. Offline, or when delivery fails with a
   * network error: keep the report in Local Storage as "Pending Synchronization".
   * Throws ReportValidationError, a non-retryable ServiceError or LocalStorageError.
   */
  async submitReport(member: CommunityMember, report: CommunityReport): Promise<SubmitOutcome> {
    const issues = this.validateReport(report);
    if (issues.length) throw new ReportValidationError(issues);
    report.reportedAt = new Date().toISOString();

    const online = await synchronizationService.checkConnectivity();
    if (online) {
      try {
        const result = await report.submitReport(member.memberId, false);
        this.discardLocalPhotos(report);
        member.reports.unshift(report);
        return {
          kind: 'delivered',
          reportNo: result.report_no,
          status: result.status,
          flaggedDuplicate: result.flagged_duplicate,
        };
      } catch (e) {
        if (!isRetryableError(e)) throw toSubmitError(e);
      }
    }

    await localStore.saveCommunityReport(report.toPayload(member.memberId), this.label(report), report.reportId);
    report.isOffline = true;
    member.reports.unshift(report);
    return { kind: 'stored', reason: online ? 'network' : 'offline' };
  }

  /** Local copies are removed once the photos are stored in the report-photos bucket. */
  discardLocalPhotos(report: CommunityReport): void {
    report.photos.forEach((p) => {
      if (p.isLocal()) deleteLocalPhoto(p.photoPath);
    });
  }

  private label(report: CommunityReport): string {
    return `${report.conflictType?.getTypeName() ?? 'Conflict'} · ${formatTime(report.reportedAt)}`;
  }
}

export const reportController = new ReportController();
