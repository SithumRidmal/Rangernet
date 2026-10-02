import type { AppRole, Profile } from '@shared/types';
import { analysisController, type SubmitOptions } from '../services/AnalysisController';
import { reportService, type GeneratedReport } from '../services/ReportService';
import type { AnalysisLocation, AnalysisResults, AnalysisType, DateRange, ReportRecord } from './types';

/** ParkManager (class diagram) – the Wildlife Conservation Officer who runs analyses and requests reports. */
export class ParkManager {
  constructor(
    readonly managerId: string,
    readonly name: string,
    readonly role: AppRole,
  ) {}

  static fromProfile(profile: Profile): ParkManager {
    return new ParkManager(profile.id, profile.full_name, profile.role);
  }

  viewAnalysis(
    type: AnalysisType,
    location: AnalysisLocation,
    dateRange: DateRange,
    options: Omit<SubmitOptions, 'requestedBy'>,
  ): Promise<AnalysisResults> {
    return analysisController.submitAnalysisRequest(type, location, dateRange, { ...options, requestedBy: this.managerId });
  }

  requestReport(results: AnalysisResults): Promise<GeneratedReport> {
    return reportService.generateConservationReport(results, 'PDF', { managerId: this.managerId, name: this.name });
  }

  /** 1 → 0..* Report */
  reports(limit?: number): Promise<ReportRecord[]> {
    return reportService.listReports(limit);
  }
}
