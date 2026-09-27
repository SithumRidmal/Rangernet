import { supabase } from '@shared/lib/supabase';
import { unwrap } from '@shared/utils/errors';
import type { Profile } from '@shared/types';
import type { CommunityReport } from './CommunityReport';
import { ResponseAssignment } from './ResponseAssignment';
import type { Severity } from '../services/rows';

export class CommunityLiaisonOfficer {
  constructor(
    public officerId: string,
    public name: string,
    public assignedArea: string | null,
  ) {}

  static fromProfile(p: Profile): CommunityLiaisonOfficer {
    return new CommunityLiaisonOfficer(p.id, p.full_name, p.assigned_area);
  }

  /** Opening a new report moves it to "Under Review" and records the reviewer. */
  async reviewCommunityReport(report: CommunityReport): Promise<void> {
    if (report.status !== 'Reported') return;
    unwrap(await supabase.rpc('review_community_report', { p_report_id: report.reportId }));
    report.status = 'Under Review';
    report.reviewedAt = report.reviewedAt ?? new Date().toISOString();
  }

  assessConflictSeverity(report: CommunityReport, severity: Severity, isHighRisk: boolean, note: string): Promise<string> {
    return report.assessSeverity(severity, isHighRisk, note);
  }

  /** High-risk path: mark report high risk → notify ranger (done by coordinate_response). */
  async coordinateResponse(report: CommunityReport, rangerId: string, instructions: string): Promise<ResponseAssignment> {
    const assignment = report.assignment ?? ResponseAssignment.forReport(report.reportId);
    await assignment.assignRanger(rangerId, instructions);
    assignment.officerId = this.officerId;
    report.assignment = assignment;
    report.isHighRisk = true;
    report.status = 'Responding';
    return assignment;
  }
}
