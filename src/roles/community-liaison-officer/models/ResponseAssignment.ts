import { supabase } from '@shared/lib/supabase';
import { ServiceError, unwrap } from '@shared/utils/errors';
import { one, type AssignmentRow, type PersonRow, type ReportStatus, type ResponseStatus } from '../services/rows';

export const RESPONSE_FLOW: readonly ResponseStatus[] = ['Assigned', 'Acknowledged', 'Responding', 'Resolved'];

export class ResponseAssignment {
  assignmentId: string | null;
  reportId: string;
  assignedAt: string | null;
  responseStatus: ResponseStatus;
  rangerId: string | null;
  officerId: string | null;
  instructions: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  responseNotes: string | null;
  updatedAt: string | null;
  ranger: PersonRow | null;

  private constructor(reportId: string) {
    this.assignmentId = null;
    this.reportId = reportId;
    this.assignedAt = null;
    this.responseStatus = 'Assigned';
    this.rangerId = null;
    this.officerId = null;
    this.instructions = null;
    this.acknowledgedAt = null;
    this.resolvedAt = null;
    this.responseNotes = null;
    this.updatedAt = null;
    this.ranger = null;
  }

  /** A not-yet-stored assignment for a report that has no ranger yet. */
  static forReport(reportId: string): ResponseAssignment {
    return new ResponseAssignment(reportId);
  }

  static fromRow(row: AssignmentRow): ResponseAssignment {
    const a = new ResponseAssignment(row.report_id);
    a.assignmentId = row.assignment_id;
    a.assignedAt = row.assigned_at;
    a.responseStatus = row.response_status;
    a.rangerId = row.ranger_id;
    a.officerId = row.officer_id;
    a.instructions = row.instructions;
    a.acknowledgedAt = row.acknowledged_at;
    a.resolvedAt = row.resolved_at;
    a.responseNotes = row.response_notes;
    a.updatedAt = row.updated_at;
    a.ranger = one(row.ranger);
    return a;
  }

  get isActive(): boolean {
    return this.assignmentId !== null && this.responseStatus !== 'Resolved';
  }

  get rangerName(): string {
    return this.ranger?.full_name || 'Ranger';
  }

  /** Statuses the CLO may move the response to from the current one. */
  nextStatuses(): ResponseStatus[] {
    const idx = RESPONSE_FLOW.indexOf(this.responseStatus);
    return RESPONSE_FLOW.slice(idx + 1);
  }

  /** Creates the assignment, or reassigns it when one already exists (coordinate_response is idempotent per report). */
  async assignRanger(rangerId: string, instructions: string): Promise<string> {
    if (!rangerId) throw new ServiceError('Please select a ranger', '22023');
    const id = unwrap(
      await supabase.rpc('coordinate_response', {
        p_report_id: this.reportId,
        p_ranger_id: rangerId,
        p_instructions: instructions.trim() || null,
      }),
    ) as string;
    this.assignmentId = id;
    this.rangerId = rangerId;
    this.responseStatus = 'Assigned';
    this.assignedAt = new Date().toISOString();
    this.acknowledgedAt = null;
    this.resolvedAt = null;
    this.instructions = instructions.trim() || null;
    return id;
  }

  async updateResponseStatus(status: ResponseStatus, notes: string): Promise<{ responseStatus: ResponseStatus; reportStatus: ReportStatus }> {
    if (!this.assignmentId) throw new ServiceError('No ranger has been assigned yet', '22023');
    if (status === 'Assigned') throw new ServiceError('Invalid response status', '22023');
    const res = unwrap(
      await supabase.rpc('update_response_status', {
        p_assignment_id: this.assignmentId,
        p_status: status,
        p_notes: notes.trim() || null,
      }),
    ) as { response_status: ResponseStatus; report_status: ReportStatus };
    this.responseStatus = res.response_status;
    if (notes.trim()) this.responseNotes = notes.trim();
    return { responseStatus: res.response_status, reportStatus: res.report_status };
  }
}
