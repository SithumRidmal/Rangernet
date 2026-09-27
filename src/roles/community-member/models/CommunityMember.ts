import type { Profile } from '@shared/types';
import type { CommunityReport } from './CommunityReport';
import { reportController, type SubmitOutcome } from '../services/ReportController';

/** CommunityMember (class diagram): 1 member -> 0..* CommunityReport. */
export class CommunityMember {
  readonly memberId: string;
  readonly name: string;
  readonly contactNumber: string | null;
  readonly village: string | null;
  reports: CommunityReport[] = [];

  constructor(memberId: string, name: string, contactNumber: string | null, village: string | null) {
    this.memberId = memberId;
    this.name = name;
    this.contactNumber = contactNumber;
    this.village = village;
  }

  static fromProfile(p: Profile): CommunityMember {
    return new CommunityMember(p.id, p.full_name, p.contact_number, p.village);
  }

  submitCommunityReport(report: CommunityReport): Promise<SubmitOutcome> {
    return reportController.submitReport(this, report);
  }
}
