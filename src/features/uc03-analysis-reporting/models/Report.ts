import * as Print from 'expo-print';
import { newId } from '@shared/utils/id';
import { buildConservationReportHtml } from '../services/reportHtml';
import { formatRange } from '../services/dates';
import { ANALYSIS_TYPE_LABELS, type AnalysisResults, type ReportRecord } from './types';

export type GeneratedPdf = { uri: string; numberOfPages: number };

/** Report (class diagram): a conservation report generated from one analysis. */
export class Report {
  constructor(
    readonly reportId: string,
    readonly reportType: string,
    readonly generatedAt: string,
    readonly title: string,
  ) {}

  static forAnalysis(results: AnalysisResults): Report {
    const type = ANALYSIS_TYPE_LABELS[results.analysisType];
    const parks = results.isCombined ? `${results.parkNames.length} parks` : results.parkNames[0] ?? 'Park';
    const where = results.zoneName ? `${parks} (${results.zoneName})` : parks;
    return new Report(newId(), type, new Date().toISOString(), `${type} – ${where} – ${formatRange({ from: results.dateFrom, to: results.dateTo })}`);
  }

  static fromRecord(record: ReportRecord): Report {
    return new Report(record.report_id, record.report_type, record.generated_at, record.title);
  }

  storagePath(uid: string): string {
    return `${uid}/${this.reportId}.pdf`;
  }

  /** Renders the report HTML to a PDF file in the app cache directory. */
  async generateReport(results: AnalysisResults, preparedBy: string): Promise<GeneratedPdf> {
    const html = buildConservationReportHtml({
      reportRef: this.reportId.slice(0, 8).toUpperCase(),
      title: this.title,
      results,
      preparedBy,
      generatedAt: this.generatedAt,
    });
    const { uri, numberOfPages } = await Print.printToFileAsync({ html });
    return { uri, numberOfPages };
  }
}
