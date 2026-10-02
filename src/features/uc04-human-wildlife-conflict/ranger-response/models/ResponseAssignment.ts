import type { ResponseStatus } from '@navigation/ranger/CentralOperationsSystem';

export type AssignmentStatus = 'Assigned' | ResponseStatus;

export type AssignmentRow = {
  assignment_id: string;
  report_id: string;
  officer_id: string | null;
  ranger_id: string;
  assigned_at: string;
  response_status: AssignmentStatus;
  instructions: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  response_notes: string | null;
  report: {
    report_id: string;
    report_no: number;
    type_id: number;
    description: string | null;
    reported_at: string;
    status: string;
    severity: string | null;
    is_high_risk: boolean;
    report_channel: 'APP' | 'SMS';
    sms_sender: string | null;
    member_id: string | null;
    location: {
      latitude: number | null;
      longitude: number | null;
      manually_marked: boolean;
      location_description: string | null;
    } | null;
    photos: { photo_id: string; photo_path: string; captured_at: string }[] | null;
  } | null;
  officer: { full_name: string; contact_number: string | null } | null;
};

const NEXT: Record<AssignmentStatus, ResponseStatus | null> = {
  Assigned: 'Acknowledged',
  Acknowledged: 'Responding',
  Responding: 'Resolved',
  Resolved: null,
};

/** ResponseAssignment (class diagram): assignmentId, assignedAt, responseStatus; assignRanger(), updateResponseStatus(). */
export class ResponseAssignment {
  readonly assignmentId: string;
  readonly assignedAt: string;
  responseStatus: AssignmentStatus;

  constructor(readonly row: AssignmentRow, pendingStatus?: ResponseStatus | null) {
    this.assignmentId = row.assignment_id;
    this.assignedAt = row.assigned_at;
    this.responseStatus = pendingStatus ?? row.response_status;
  }

  /** assignRanger() is performed by the Community Liaison Officer; the ranger side only reads it. */
  assignRanger(): never {
    throw new Error('Rangers cannot assign responses.');
  }

  /** The next step the ranger can record: Acknowledge -> Responding -> Resolved. */
  nextStatus(): ResponseStatus | null {
    return NEXT[this.responseStatus];
  }

  /** updateResponseStatus(): local state change; delivery happens through the outbox. */
  updateResponseStatus(status: ResponseStatus) {
    this.responseStatus = status;
  }

  get isActive() {
    return this.responseStatus !== 'Resolved';
  }
}
